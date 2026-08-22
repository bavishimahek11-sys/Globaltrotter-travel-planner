from flask import Blueprint, jsonify, request
from database import get_db_connection

api = Blueprint("api", __name__)


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@api.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "success",
        "message": "GlobalTrotter backend is running"
    })


# --------------------------------------------------
# REGISTER USER
# --------------------------------------------------

@api.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if not name or not email or not password:
        return jsonify({
            "error": "Name, email and password are required"
        }), 400

    conn = get_db_connection()

    try:
        existing_user = conn.execute(
            "SELECT id FROM users WHERE email = ?",
            (email,)
        ).fetchone()

        if existing_user:
            return jsonify({
                "error": "Email already registered"
            }), 409

        cursor = conn.execute("""
            INSERT INTO users (name, email, password)
            VALUES (?, ?, ?)
        """, (name, email, password))

        conn.commit()

        user_id = cursor.lastrowid

        return jsonify({
            "message": "User registered successfully",
            "user": {
                "id": user_id,
                "name": name,
                "email": email
            }
        }), 201

    finally:
        conn.close()


# --------------------------------------------------
# LOGIN
# --------------------------------------------------

@api.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({
            "error": "Email and password are required"
        }), 400

    conn = get_db_connection()

    try:
        user = conn.execute("""
            SELECT id, name, email, password
            FROM users
            WHERE email = ?
        """, (email,)).fetchone()

        if not user:
            return jsonify({
                "error": "Invalid email or password"
            }), 401

        if user["password"] != password:
            return jsonify({
                "error": "Invalid email or password"
            }), 401

        return jsonify({
            "message": "Login successful",
            "user": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"]
            }
        }), 200

    finally:
        conn.close()


# --------------------------------------------------
# CREATE TRIP
# --------------------------------------------------

@api.route("/api/trips", methods=["POST"])
def create_trip():
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    user_id = data.get("user_id")
    name = data.get("name")
    start_date = data.get("start_date")
    end_date = data.get("end_date")
    budget = data.get("budget", 0)

    if not user_id or not name:
        return jsonify({
            "error": "user_id and trip name are required"
        }), 400

    try:
        budget = float(budget)
    except (TypeError, ValueError):
        return jsonify({
            "error": "Budget must be a number"
        }), 400

    if budget < 0:
        return jsonify({
            "error": "Budget cannot be negative"
        }), 400

    conn = get_db_connection()

    try:
        user = conn.execute(
            "SELECT id FROM users WHERE id = ?",
            (user_id,)
        ).fetchone()

        if not user:
            return jsonify({
                "error": "User not found"
            }), 404

        cursor = conn.execute("""
            INSERT INTO trips (
                user_id,
                name,
                start_date,
                end_date,
                budget
            )
            VALUES (?, ?, ?, ?, ?)
        """, (
            user_id,
            name,
            start_date,
            end_date,
            budget
        ))

        conn.commit()

        trip_id = cursor.lastrowid

        return jsonify({
            "message": "Trip created successfully",
            "trip": {
                "id": trip_id,
                "user_id": user_id,
                "name": name,
                "start_date": start_date,
                "end_date": end_date,
                "budget": budget
            }
        }), 201

    finally:
        conn.close()


# --------------------------------------------------
# GET USER'S TRIPS
# --------------------------------------------------

@api.route("/api/trips/<int:user_id>", methods=["GET"])
def get_user_trips(user_id):
    conn = get_db_connection()

    try:
        user = conn.execute(
            "SELECT id FROM users WHERE id = ?",
            (user_id,)
        ).fetchone()

        if not user:
            return jsonify({
                "error": "User not found"
            }), 404

        trips = conn.execute("""
            SELECT
                id,
                user_id,
                name,
                start_date,
                end_date,
                budget,
                created_at
            FROM trips
            WHERE user_id = ?
            ORDER BY created_at DESC
        """, (user_id,)).fetchall()

        trip_list = []

        for trip in trips:
            trip_list.append({
                "id": trip["id"],
                "user_id": trip["user_id"],
                "name": trip["name"],
                "start_date": trip["start_date"],
                "end_date": trip["end_date"],
                "budget": trip["budget"],
                "created_at": trip["created_at"]
            })

        return jsonify({
            "trips": trip_list
        }), 200

    finally:
        conn.close()

@api.route("/api/trips/<int:trip_id>/destinations", methods=["POST"])
def add_destination(trip_id):
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    name = data.get("name")
    city = data.get("city")
    country = data.get("country")
    visit_date = data.get("visit_date")
    notes = data.get("notes")

    if not name:
        return jsonify({
            "error": "Destination name is required"
        }), 400

    conn = get_db_connection()

    try:
        trip = conn.execute(
            "SELECT id FROM trips WHERE id = ?",
            (trip_id,)
        ).fetchone()

        if not trip:
            return jsonify({
                "error": "Trip not found"
            }), 404

        cursor = conn.execute("""
            INSERT INTO destinations (
                trip_id,
                name,
                city,
                country,
                visit_date,
                notes
            )
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            trip_id,
            name,
            city,
            country,
            visit_date,
            notes
        ))

        conn.commit()

        return jsonify({
            "message": "Destination added successfully",
            "destination": {
                "id": cursor.lastrowid,
                "trip_id": trip_id,
                "name": name,
                "city": city,
                "country": country,
                "visit_date": visit_date,
                "notes": notes
            }
        }), 201

    finally:
        conn.close()

@api.route("/api/trips/<int:trip_id>/destinations", methods=["GET"])
def get_destinations(trip_id):
    conn = get_db_connection()

    try:
        trip = conn.execute(
            "SELECT id FROM trips WHERE id = ?",
            (trip_id,)
        ).fetchone()

        if not trip:
            return jsonify({
                "error": "Trip not found"
            }), 404

        destinations = conn.execute("""
            SELECT
                id,
                trip_id,
                name,
                city,
                country,
                visit_date,
                notes
            FROM destinations
            WHERE trip_id = ?
            ORDER BY visit_date ASC
        """, (trip_id,)).fetchall()

        return jsonify({
            "destinations": [dict(destination) for destination in destinations]
        }), 200

    finally:
        conn.close()

@api.route("/api/trips/<int:trip_id>/itinerary", methods=["POST"])
def add_itinerary_item(trip_id):
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    activity = data.get("activity")
    destination_id = data.get("destination_id")
    activity_date = data.get("activity_date")
    start_time = data.get("start_time")
    end_time = data.get("end_time")
    notes = data.get("notes")

    if not activity:
        return jsonify({
            "error": "Activity is required"
        }), 400

    conn = get_db_connection()

    try:
        trip = conn.execute(
            "SELECT id FROM trips WHERE id = ?",
            (trip_id,)
        ).fetchone()

        if not trip:
            return jsonify({
                "error": "Trip not found"
            }), 404

        if destination_id:
            destination = conn.execute("""
                SELECT id
                FROM destinations
                WHERE id = ? AND trip_id = ?
            """, (destination_id, trip_id)).fetchone()

            if not destination:
                return jsonify({
                    "error": "Destination does not belong to this trip"
                }), 400

        cursor = conn.execute("""
            INSERT INTO itinerary (
                trip_id,
                destination_id,
                activity,
                activity_date,
                start_time,
                end_time,
                notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            trip_id,
            destination_id,
            activity,
            activity_date,
            start_time,
            end_time,
            notes
        ))

        conn.commit()

        return jsonify({
            "message": "Itinerary item added successfully",
            "itinerary": {
                "id": cursor.lastrowid,
                "trip_id": trip_id,
                "destination_id": destination_id,
                "activity": activity,
                "activity_date": activity_date,
                "start_time": start_time,
                "end_time": end_time,
                "notes": notes
            }
        }), 201

    finally:
        conn.close()

@api.route("/api/trips/<int:trip_id>/itinerary", methods=["GET"])
def get_itinerary(trip_id):
    conn = get_db_connection()

    try:
        trip = conn.execute(
            "SELECT id FROM trips WHERE id = ?",
            (trip_id,)
        ).fetchone()

        if not trip:
            return jsonify({
                "error": "Trip not found"
            }), 404

        itinerary = conn.execute("""
            SELECT
                itinerary.id,
                itinerary.trip_id,
                itinerary.destination_id,
                itinerary.activity,
                itinerary.activity_date,
                itinerary.start_time,
                itinerary.end_time,
                itinerary.notes,
                destinations.name AS destination_name
            FROM itinerary
            LEFT JOIN destinations
                ON itinerary.destination_id = destinations.id
            WHERE itinerary.trip_id = ?
            ORDER BY
                itinerary.activity_date ASC,
                itinerary.start_time ASC
        """, (trip_id,)).fetchall()

        return jsonify({
            "itinerary": [dict(item) for item in itinerary]
        }), 200

    finally:
        conn.close()

@api.route("/api/itinerary/<int:itinerary_id>", methods=["DELETE"])
def delete_itinerary_item(itinerary_id):
    conn = get_db_connection()

    try:
        item = conn.execute(
            "SELECT id FROM itinerary WHERE id = ?",
            (itinerary_id,)
        ).fetchone()

        if not item:
            return jsonify({
                "error": "Itinerary item not found"
            }), 404

        conn.execute(
            "DELETE FROM itinerary WHERE id = ?",
            (itinerary_id,)
        )

        conn.commit()

        return jsonify({
            "message": "Itinerary item deleted successfully"
        }), 200

    finally:
        conn.close()

