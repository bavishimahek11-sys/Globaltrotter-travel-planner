from flask import Blueprint, jsonify, request
from database import get_db_connection
import secrets

api = Blueprint("api", __name__)


def get_trip_permission(conn, trip_id, user_id):
    trip = conn.execute("""
        SELECT user_id
        FROM trips
        WHERE id = ?
    """, (trip_id,)).fetchone()

    if not trip:
        return None

    # Trip owner
    if trip["user_id"] == user_id:
        return "owner"

    # Check collaborator
    collaborator = conn.execute("""
        SELECT role
        FROM trip_collaborators
        WHERE trip_id = ?
        AND user_id = ?
    """, (
        trip_id,
        user_id
    )).fetchone()

    if collaborator:
        return collaborator["role"]

    return None

def require_trip_access(conn, trip_id, user_id):
    permission = get_trip_permission(
        conn,
        trip_id,
        user_id
    )

    if permission is None:
        return None, jsonify({
            "error": "You do not have access to this trip"
        }), 403

    return permission, None, None


def require_editor_access(conn, trip_id, user_id):
    permission = get_trip_permission(
        conn,
        trip_id,
        user_id
    )

    if permission is None:
        return None, jsonify({
            "error": "You do not have access to this trip"
        }), 403

    if permission not in ["owner", "editor"]:
        return None, jsonify({
            "error": "You do not have permission to modify this trip"
        }), 403

    return permission, None, None

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
    latitude = data.get("latitude")
    longitude = data.get("longitude")

    if not name:
        return jsonify({
            "error": "Destination name is required"
        }), 400

    # Coordinates are optional.
    # If supplied, both must be valid numbers.
    if latitude is not None or longitude is not None:
        if latitude is None or longitude is None:
            return jsonify({
                "error": "Both latitude and longitude are required"
            }), 400

        try:
            latitude = float(latitude)
            longitude = float(longitude)
        except (TypeError, ValueError):
            return jsonify({
                "error": "Latitude and longitude must be numbers"
            }), 400

        if not -90 <= latitude <= 90:
            return jsonify({
                "error": "Latitude must be between -90 and 90"
            }), 400

        if not -180 <= longitude <= 180:
            return jsonify({
                "error": "Longitude must be between -180 and 180"
            }), 400

    conn = get_db_connection()

    try:
        trip = conn.execute("""
            SELECT id
            FROM trips
            WHERE id = ?
        """, (trip_id,)).fetchone()

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
                notes,
                latitude,
                longitude
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            trip_id,
            name,
            city,
            country,
            visit_date,
            notes,
            latitude,
            longitude
        ))

        conn.commit()

        destination = conn.execute("""
            SELECT
                id,
                trip_id,
                name,
                city,
                country,
                visit_date,
                notes,
                latitude,
                longitude
            FROM destinations
            WHERE id = ?
        """, (cursor.lastrowid,)).fetchone()

        return jsonify({
            "message": "Destination added successfully",
            "destination": dict(destination)
        }), 201

    finally:
        conn.close()

@api.route("/api/trips/<int:trip_id>/destinations", methods=["GET"])
def get_destinations(trip_id):
    conn = get_db_connection()

    try:
        trip = conn.execute("""
            SELECT id
            FROM trips
            WHERE id = ?
        """, (trip_id,)).fetchone()

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
                notes,
                latitude,
                longitude
            FROM destinations
            WHERE trip_id = ?
            ORDER BY visit_date ASC, id ASC
        """, (trip_id,)).fetchall()

        return jsonify({
            "destinations": [
                dict(destination)
                for destination in destinations
            ]
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

    user_id = data.get("user_id")
    activity = data.get("activity")
    destination_id = data.get("destination_id")
    activity_date = data.get("activity_date")
    start_time = data.get("start_time")
    end_time = data.get("end_time")
    notes = data.get("notes")

    if user_id is None:
        return jsonify({
            "error": "User ID is required"
        }), 400

    if not activity:
        return jsonify({
            "error": "Activity is required"
        }), 400

    conn = get_db_connection()

    try:
        # Check trip permission
        permission = get_trip_permission(
            conn,
            trip_id,
            int(user_id)
        )

        if permission is None:
            return jsonify({
                "error": "You do not have access to this trip"
            }), 403

        if permission not in ["owner", "editor"]:
            return jsonify({
                "error": "You do not have permission to modify this trip"
            }), 403

        # Check destination belongs to this trip
        if destination_id is not None:
            destination = conn.execute("""
                SELECT id
                FROM destinations
                WHERE id = ?
                AND trip_id = ?
            """, (
                destination_id,
                trip_id
            )).fetchone()

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

        itinerary_item = conn.execute("""
            SELECT
                itinerary.id,
                itinerary.trip_id,
                itinerary.destination_id,
                itinerary.activity,
                itinerary.activity_date,
                itinerary.start_time,
                itinerary.end_time,
                itinerary.notes,
                destinations.name AS destination_name,
                destinations.city AS destination_city,
                destinations.country AS destination_country,
                destinations.latitude,
                destinations.longitude
            FROM itinerary
            LEFT JOIN destinations
                ON itinerary.destination_id = destinations.id
            WHERE itinerary.id = ?
        """, (cursor.lastrowid,)).fetchone()

        return jsonify({
            "message": "Itinerary item added successfully",
            "itinerary": dict(itinerary_item)
        }), 201

    finally:
        conn.close()

@api.route("/api/trips/<int:trip_id>/itinerary", methods=["GET"])
def get_itinerary(trip_id):
    conn = get_db_connection()

    try:
        trip = conn.execute("""
            SELECT id
            FROM trips
            WHERE id = ?
        """, (trip_id,)).fetchone()

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

                destinations.name AS destination_name,
                destinations.city AS destination_city,
                destinations.country AS destination_country,
                destinations.latitude AS latitude,
                destinations.longitude AS longitude

            FROM itinerary

            LEFT JOIN destinations
                ON itinerary.destination_id = destinations.id

            WHERE itinerary.trip_id = ?

            ORDER BY
                itinerary.activity_date ASC,
                itinerary.start_time ASC,
                itinerary.id ASC
        """, (trip_id,)).fetchall()

        return jsonify({
            "itinerary": [
                dict(item)
                for item in itinerary
            ]
        }), 200

    finally:
        conn.close()

@api.route(
    "/api/itinerary/<int:itinerary_id>",
    methods=["DELETE"]
)
def delete_itinerary_item(itinerary_id):
    data = request.get_json(silent=True) or {}

    user_id = data.get("user_id")

    if user_id is None:
        return jsonify({
            "error": "User ID is required"
        }), 400

    conn = get_db_connection()

    try:
        item = conn.execute("""
            SELECT trip_id
            FROM itinerary
            WHERE id = ?
        """, (itinerary_id,)).fetchone()

        if not item:
            return jsonify({
                "error": "Itinerary item not found"
            }), 404

        permission, error_response, status = require_editor_access(
            conn,
            item["trip_id"],
            int(user_id)
        )

        if error_response:
            return error_response, status

        conn.execute("""
            DELETE FROM itinerary
            WHERE id = ?
        """, (itinerary_id,))

        conn.commit()

        return jsonify({
            "message": "Itinerary item deleted successfully"
        }), 200

    finally:
        conn.close()

@api.route("/api/trips/<int:trip_id>/budget", methods=["PUT"])
def update_budget(trip_id):
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    user_id = data.get("user_id")
    budget = data.get("budget")

    if user_id is None:
        return jsonify({
            "error": "User ID is required"
        }), 400

    if budget is None:
        return jsonify({
            "error": "Budget is required"
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
        permission, error_response, status = require_editor_access(
            conn,
            trip_id,
            int(user_id)
        )

        if error_response:
            return error_response, status

        trip = conn.execute("""
            SELECT id
            FROM trips
            WHERE id = ?
        """, (trip_id,)).fetchone()

        if not trip:
            return jsonify({
                "error": "Trip not found"
            }), 404

        conn.execute("""
            UPDATE trips
            SET budget = ?
            WHERE id = ?
        """, (
            budget,
            trip_id
        ))

        conn.commit()

        updated_trip = conn.execute("""
            SELECT
                id,
                name,
                budget
            FROM trips
            WHERE id = ?
        """, (trip_id,)).fetchone()

        return jsonify({
            "message": "Budget updated successfully",
            "trip": dict(updated_trip)
        }), 200

    finally:
        conn.close()
        
@api.route("/api/trips/<int:trip_id>/expenses", methods=["POST"])
def add_expense(trip_id):
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    category = data.get("category")
    description = data.get("description")
    amount = data.get("amount")
    expense_date = data.get("expense_date")

    if not category:
        return jsonify({
            "error": "Expense category is required"
        }), 400

    if amount is None:
        return jsonify({
            "error": "Expense amount is required"
        }), 400

    try:
        amount = float(amount)
    except (TypeError, ValueError):
        return jsonify({
            "error": "Amount must be a number"
        }), 400

    if amount <= 0:
        return jsonify({
            "error": "Expense amount must be greater than 0"
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
            INSERT INTO expenses (
                trip_id,
                category,
                description,
                amount,
                expense_date
            )
            VALUES (?, ?, ?, ?, ?)
        """, (
            trip_id,
            category,
            description,
            amount,
            expense_date
        ))

        conn.commit()

        return jsonify({
            "message": "Expense added successfully",
            "expense": {
                "id": cursor.lastrowid,
                "trip_id": trip_id,
                "category": category,
                "description": description,
                "amount": amount,
                "expense_date": expense_date
            }
        }), 201

    finally:
        conn.close()

@api.route("/api/trips/<int:trip_id>/expenses", methods=["GET"])
def get_expenses(trip_id):
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

        expenses = conn.execute("""
            SELECT
                id,
                trip_id,
                category,
                description,
                amount,
                expense_date,
                created_at
            FROM expenses
            WHERE trip_id = ?
            ORDER BY expense_date DESC, created_at DESC
        """, (trip_id,)).fetchall()

        return jsonify({
            "expenses": [dict(expense) for expense in expenses]
        }), 200

    finally:
        conn.close()

@api.route("/api/expenses/<int:expense_id>", methods=["DELETE"])
def delete_expense(expense_id):
    conn = get_db_connection()

    try:
        expense = conn.execute(
            "SELECT id FROM expenses WHERE id = ?",
            (expense_id,)
        ).fetchone()

        if not expense:
            return jsonify({
                "error": "Expense not found"
            }), 404

        conn.execute(
            "DELETE FROM expenses WHERE id = ?",
            (expense_id,)
        )

        conn.commit()

        return jsonify({
            "message": "Expense deleted successfully"
        }), 200

    finally:
        conn.close()

@api.route("/api/trips/<int:trip_id>/budget-summary", methods=["GET"])
def get_budget_summary(trip_id):
    conn = get_db_connection()

    try:
        trip = conn.execute("""
            SELECT id, budget
            FROM trips
            WHERE id = ?
        """, (trip_id,)).fetchone()

        if not trip:
            return jsonify({
                "error": "Trip not found"
            }), 404

        result = conn.execute("""
            SELECT COALESCE(SUM(amount), 0) AS total_spent
            FROM expenses
            WHERE trip_id = ?
        """, (trip_id,)).fetchone()

        total_budget = float(trip["budget"] or 0)
        total_spent = float(result["total_spent"] or 0)
        remaining_budget = total_budget - total_spent

        return jsonify({
            "trip_id": trip_id,
            "total_budget": total_budget,
            "total_spent": total_spent,
            "remaining_budget": remaining_budget
        }), 200

    finally:
        conn.close()

@api.route("/api/trips/<int:trip_id>", methods=["PUT"])
def update_trip(trip_id):
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    user_id = data.get("user_id")

    if user_id is None:
        return jsonify({
            "error": "User ID is required"
        }), 400

    name = data.get("name")
    start_date = data.get("start_date")
    end_date = data.get("end_date")
    budget = data.get("budget")

    if not name:
        return jsonify({
            "error": "Trip name is required"
        }), 400

    conn = get_db_connection()

    try:
        permission, error_response, status = require_trip_access(
            conn,
            trip_id,
            int(user_id)
        )

        if error_response:
            return error_response, status

        # Only owner can change main trip details
        if permission != "owner":
            return jsonify({
                "error": "Only the trip owner can update trip details"
            }), 403

        if budget is not None:
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

        conn.execute("""
            UPDATE trips
            SET name = ?,
                start_date = ?,
                end_date = ?,
                budget = COALESCE(?, budget)
            WHERE id = ?
        """, (
            name,
            start_date,
            end_date,
            budget,
            trip_id
        ))

        conn.commit()

        trip = conn.execute("""
            SELECT
                id,
                user_id,
                name,
                start_date,
                end_date,
                budget,
                created_at
            FROM trips
            WHERE id = ?
        """, (trip_id,)).fetchone()

        return jsonify({
            "message": "Trip updated successfully",
            "trip": dict(trip)
        }), 200

    finally:
        conn.close()

@api.route("/api/trips/<int:trip_id>", methods=["DELETE"])
def delete_trip(trip_id):
    data = request.get_json(silent=True) or {}

    user_id = data.get("user_id")

    if user_id is None:
        return jsonify({
            "error": "User ID is required"
        }), 400

    conn = get_db_connection()

    try:
        permission, error_response, status = require_trip_access(
            conn,
            trip_id,
            int(user_id)
        )

        if error_response:
            return error_response, status

        if permission != "owner":
            return jsonify({
                "error": "Only the trip owner can delete the trip"
            }), 403

        conn.execute("""
            DELETE FROM trips
            WHERE id = ?
        """, (trip_id,))

        conn.commit()

        return jsonify({
            "message": "Trip deleted successfully"
        }), 200

    finally:
        conn.close()

@api.route("/api/destinations/<int:destination_id>", methods=["PUT"])
def update_destination(destination_id):
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    user_id = data.get("user_id")

    if user_id is None:
        return jsonify({
            "error": "User ID is required"
        }), 400

    conn = get_db_connection()

    try:
        destination = conn.execute("""
            SELECT trip_id
            FROM destinations
            WHERE id = ?
        """, (destination_id,)).fetchone()

        if not destination:
            return jsonify({
                "error": "Destination not found"
            }), 404

        permission, error_response, status = require_editor_access(
            conn,
            destination["trip_id"],
            int(user_id)
        )

        if error_response:
            return error_response, status

        name = data.get("name")
        city = data.get("city")
        country = data.get("country")
        visit_date = data.get("visit_date")
        notes = data.get("notes")
        latitude = data.get("latitude")
        longitude = data.get("longitude")

        if not name:
            return jsonify({
                "error": "Destination name is required"
            }), 400

        conn.execute("""
            UPDATE destinations
            SET name = ?,
                city = ?,
                country = ?,
                visit_date = ?,
                notes = ?,
                latitude = ?,
                longitude = ?
            WHERE id = ?
        """, (
            name,
            city,
            country,
            visit_date,
            notes,
            latitude,
            longitude,
            destination_id
        ))

        conn.commit()

        updated_destination = conn.execute("""
            SELECT
                id,
                trip_id,
                name,
                city,
                country,
                visit_date,
                notes,
                latitude,
                longitude
            FROM destinations
            WHERE id = ?
        """, (destination_id,)).fetchone()

        return jsonify({
            "message": "Destination updated successfully",
            "destination": dict(updated_destination)
        }), 200

    finally:
        conn.close()

@api.route(
    "/api/destinations/<int:destination_id>",
    methods=["DELETE"]
)
def delete_destination(destination_id):
    data = request.get_json(silent=True) or {}

    user_id = data.get("user_id")

    if user_id is None:
        return jsonify({
            "error": "User ID is required"
        }), 400

    conn = get_db_connection()

    try:
        destination = conn.execute("""
            SELECT trip_id
            FROM destinations
            WHERE id = ?
        """, (destination_id,)).fetchone()

        if not destination:
            return jsonify({
                "error": "Destination not found"
            }), 404

        permission, error_response, status = require_editor_access(
            conn,
            destination["trip_id"],
            int(user_id)
        )

        if error_response:
            return error_response, status

        conn.execute("""
            DELETE FROM destinations
            WHERE id = ?
        """, (destination_id,))

        conn.commit()

        return jsonify({
            "message": "Destination deleted successfully"
        }), 200

    finally:
        conn.close()

@api.route("/api/itinerary/<int:itinerary_id>", methods=["PUT"])
def update_itinerary_item(itinerary_id):
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    user_id = data.get("user_id")

    if user_id is None:
        return jsonify({
            "error": "User ID is required"
        }), 400

    conn = get_db_connection()

    try:
        item = conn.execute("""
            SELECT trip_id
            FROM itinerary
            WHERE id = ?
        """, (itinerary_id,)).fetchone()

        if not item:
            return jsonify({
                "error": "Itinerary item not found"
            }), 404

        permission, error_response, status = require_editor_access(
            conn,
            item["trip_id"],
            int(user_id)
        )

        if error_response:
            return error_response, status

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

        # Make sure destination belongs to the same trip
        if destination_id is not None:
            destination = conn.execute("""
                SELECT id
                FROM destinations
                WHERE id = ?
                AND trip_id = ?
            """, (
                destination_id,
                item["trip_id"]
            )).fetchone()

            if not destination:
                return jsonify({
                    "error": "Destination does not belong to this trip"
                }), 400

        conn.execute("""
            UPDATE itinerary
            SET destination_id = ?,
                activity = ?,
                activity_date = ?,
                start_time = ?,
                end_time = ?,
                notes = ?
            WHERE id = ?
        """, (
            destination_id,
            activity,
            activity_date,
            start_time,
            end_time,
            notes,
            itinerary_id
        ))

        conn.commit()

        updated_item = conn.execute("""
            SELECT
                itinerary.id,
                itinerary.trip_id,
                itinerary.destination_id,
                itinerary.activity,
                itinerary.activity_date,
                itinerary.start_time,
                itinerary.end_time,
                itinerary.notes,
                destinations.name AS destination_name,
                destinations.latitude,
                destinations.longitude
            FROM itinerary
            LEFT JOIN destinations
                ON itinerary.destination_id = destinations.id
            WHERE itinerary.id = ?
        """, (itinerary_id,)).fetchone()

        return jsonify({
            "message": "Itinerary item updated successfully",
            "itinerary": dict(updated_item)
        }), 200

    finally:
        conn.close()

@api.route("/api/expenses/<int:expense_id>", methods=["PUT"])
def update_expense(expense_id):
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    user_id = data.get("user_id")

    if user_id is None:
        return jsonify({
            "error": "User ID is required"
        }), 400

    conn = get_db_connection()

    try:
        expense = conn.execute("""
            SELECT trip_id
            FROM expenses
            WHERE id = ?
        """, (expense_id,)).fetchone()

        if not expense:
            return jsonify({
                "error": "Expense not found"
            }), 404

        permission, error_response, status = require_editor_access(
            conn,
            expense["trip_id"],
            int(user_id)
        )

        if error_response:
            return error_response, status

        category = data.get("category")
        amount = data.get("amount")
        description = data.get("description")
        expense_date = data.get("expense_date")

        if amount is None:
            return jsonify({
                "error": "Amount is required"
            }), 400

        try:
            amount = float(amount)
        except (TypeError, ValueError):
            return jsonify({
                "error": "Amount must be a number"
            }), 400

        if amount < 0:
            return jsonify({
                "error": "Amount cannot be negative"
            }), 400

        conn.execute("""
            UPDATE expenses
            SET category = ?,
                amount = ?,
                description = ?,
                expense_date = ?
            WHERE id = ?
        """, (
            category,
            amount,
            description,
            expense_date,
            expense_id
        ))

        conn.commit()

        updated_expense = conn.execute("""
            SELECT
                id,
                trip_id,
                category,
                amount,
                description,
                expense_date
            FROM expenses
            WHERE id = ?
        """, (expense_id,)).fetchone()

        return jsonify({
            "message": "Expense updated successfully",
            "expense": dict(updated_expense)
        }), 200

    finally:
        conn.close()

@api.route(
    "/api/expenses/<int:expense_id>",
    methods=["DELETE"]
)
def delete_expense(expense_id):
    data = request.get_json(silent=True) or {}

    user_id = data.get("user_id")

    if user_id is None:
        return jsonify({
            "error": "User ID is required"
        }), 400

    conn = get_db_connection()

    try:
        expense = conn.execute("""
            SELECT trip_id
            FROM expenses
            WHERE id = ?
        """, (expense_id,)).fetchone()

        if not expense:
            return jsonify({
                "error": "Expense not found"
            }), 404

        permission, error_response, status = require_editor_access(
            conn,
            expense["trip_id"],
            int(user_id)
        )

        if error_response:
            return error_response, status

        conn.execute("""
            DELETE FROM expenses
            WHERE id = ?
        """, (expense_id,))

        conn.commit()

        return jsonify({
            "message": "Expense deleted successfully"
        }), 200

    finally:
        conn.close()


@api.route("/api/trips/<int:trip_id>/share", methods=["POST"])
def create_share_link(trip_id):
    conn = get_db_connection()

    try:
        trip = conn.execute("""
            SELECT id, name
            FROM trips
            WHERE id = ?
        """, (trip_id,)).fetchone()

        if not trip:
            return jsonify({
                "error": "Trip not found"
            }), 404

        # Check whether a share link already exists
        existing_link = conn.execute("""
            SELECT share_token
            FROM trip_share_links
            WHERE trip_id = ?
        """, (trip_id,)).fetchone()

        if existing_link:
            token = existing_link["share_token"]
        else:
            token = secrets.token_urlsafe(24)

            conn.execute("""
                INSERT INTO trip_share_links (
                    trip_id,
                    share_token
                )
                VALUES (?, ?)
            """, (
                trip_id,
                token
            ))

            conn.commit()

        return jsonify({
            "message": "Share link created successfully",
            "trip_id": trip_id,
            "share_token": token,
            "share_url": f"/shared-trip.html?token={token}"
        }), 200

    finally:
        conn.close()

@api.route("/api/shared-trips/<share_token>", methods=["GET"])
def get_shared_trip(share_token):
    conn = get_db_connection()

    try:
        trip = conn.execute("""
            SELECT
                trips.id,
                trips.name,
                trips.user_id,
                trips.start_date,
                trips.end_date,
                trips.budget
            FROM trip_share_links
            JOIN trips
                ON trip_share_links.trip_id = trips.id
            WHERE trip_share_links.share_token = ?
        """, (share_token,)).fetchone()

        if not trip:
            return jsonify({
                "error": "Invalid or expired share link"
            }), 404

        trip_id = trip["id"]

        destinations = conn.execute("""
            SELECT
                id,
                trip_id,
                name,
                city,
                country,
                visit_date,
                notes,
                latitude,
                longitude
            FROM destinations
            WHERE trip_id = ?
            ORDER BY visit_date ASC, id ASC
        """, (trip_id,)).fetchall()

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
                destinations.name AS destination_name,
                destinations.latitude,
                destinations.longitude
            FROM itinerary
            LEFT JOIN destinations
                ON itinerary.destination_id = destinations.id
            WHERE itinerary.trip_id = ?
            ORDER BY
                itinerary.activity_date ASC,
                itinerary.start_time ASC,
                itinerary.id ASC
        """, (trip_id,)).fetchall()

        collaborators = conn.execute("""
            SELECT
                users.id,
                users.name,
                users.email,
                trip_collaborators.role
            FROM trip_collaborators
            JOIN users
                ON trip_collaborators.user_id = users.id
            WHERE trip_collaborators.trip_id = ?
        """, (trip_id,)).fetchall()

        return jsonify({
            "trip": dict(trip),
            "destinations": [
                dict(destination)
                for destination in destinations
            ],
            "itinerary": [
                dict(item)
                for item in itinerary
            ],
            "collaborators": [
                dict(user)
                for user in collaborators
            ]
        }), 200

    finally:
        conn.close()

@api.route("/api/trips/<int:trip_id>/collaborators", methods=["GET"])
def get_collaborators(trip_id):
    conn = get_db_connection()

    try:
        trip = conn.execute("""
            SELECT id
            FROM trips
            WHERE id = ?
        """, (trip_id,)).fetchone()

        if not trip:
            return jsonify({
                "error": "Trip not found"
            }), 404

        owner = conn.execute("""
            SELECT
                id,
                name,
                email
            FROM users
            JOIN trips
                ON trips.user_id = users.id
            WHERE trips.id = ?
        """, (trip_id,)).fetchone()

        collaborators = conn.execute("""
            SELECT
                users.id,
                users.name,
                users.email,
                trip_collaborators.role
            FROM trip_collaborators
            JOIN users
                ON trip_collaborators.user_id = users.id
            WHERE trip_collaborators.trip_id = ?
            ORDER BY users.name
        """, (trip_id,)).fetchall()

        result = []

        if owner:
            result.append({
                "id": owner["id"],
                "name": owner["name"],
                "email": owner["email"],
                "role": "owner"
            })

        result.extend([
            dict(collaborator)
            for collaborator in collaborators
        ])

        return jsonify({
            "collaborators": result
        }), 200

    finally:
        conn.close()

@api.route("/api/trips/<int:trip_id>/collaborators", methods=["POST"])
def add_collaborator(trip_id):
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    email = data.get("email")
    role = data.get("role", "viewer")

    if not email:
        return jsonify({
            "error": "Email is required"
        }), 400

    email = email.strip().lower()

    if role not in ["viewer", "editor"]:
        return jsonify({
            "error": "Role must be viewer or editor"
        }), 400

    conn = get_db_connection()

    try:
        trip = conn.execute("""
            SELECT id, user_id
            FROM trips
            WHERE id = ?
        """, (trip_id,)).fetchone()

        if not trip:
            return jsonify({
                "error": "Trip not found"
            }), 404

        user = conn.execute("""
            SELECT id, name, email
            FROM users
            WHERE LOWER(email) = ?
        """, (email,)).fetchone()

        if not user:
            return jsonify({
                "error": "User with this email does not exist"
            }), 404

        # Owner cannot be added as collaborator
        if user["id"] == trip["user_id"]:
            return jsonify({
                "error": "Trip owner is already the owner"
            }), 400

        existing = conn.execute("""
            SELECT id
            FROM trip_collaborators
            WHERE trip_id = ?
            AND user_id = ?
        """, (
            trip_id,
            user["id"]
        )).fetchone()

        if existing:
            return jsonify({
                "error": "User is already a collaborator"
            }), 409

        conn.execute("""
            INSERT INTO trip_collaborators (
                trip_id,
                user_id,
                role
            )
            VALUES (?, ?, ?)
        """, (
            trip_id,
            user["id"],
            role
        ))

        conn.commit()

        return jsonify({
            "message": "Collaborator added successfully",
            "collaborator": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "role": role
            }
        }), 201

    finally:
        conn.close()

@api.route(
    "/api/trips/<int:trip_id>/collaborators/<int:user_id>",
    methods=["PUT"]
)
def update_collaborator_role(trip_id, user_id):
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    role = data.get("role")

    if role not in ["viewer", "editor"]:
        return jsonify({
            "error": "Role must be viewer or editor"
        }), 400

    conn = get_db_connection()

    try:
        collaborator = conn.execute("""
            SELECT id
            FROM trip_collaborators
            WHERE trip_id = ?
            AND user_id = ?
        """, (
            trip_id,
            user_id
        )).fetchone()

        if not collaborator:
            return jsonify({
                "error": "Collaborator not found"
            }), 404

        conn.execute("""
            UPDATE trip_collaborators
            SET role = ?
            WHERE trip_id = ?
            AND user_id = ?
        """, (
            role,
            trip_id,
            user_id
        ))

        conn.commit()

        return jsonify({
            "message": "Collaborator role updated successfully",
            "user_id": user_id,
            "role": role
        }), 200

    finally:
        conn.close()

@api.route(
    "/api/trips/<int:trip_id>/collaborators/<int:user_id>",
    methods=["DELETE"]
)
def remove_collaborator(trip_id, user_id):
    conn = get_db_connection()

    try:
        collaborator = conn.execute("""
            SELECT id
            FROM trip_collaborators
            WHERE trip_id = ?
            AND user_id = ?
        """, (
            trip_id,
            user_id
        )).fetchone()

        if not collaborator:
            return jsonify({
                "error": "Collaborator not found"
            }), 404

        conn.execute("""
            DELETE FROM trip_collaborators
            WHERE trip_id = ?
            AND user_id = ?
        """, (
            trip_id,
            user_id
        ))

        conn.commit()

        return jsonify({
            "message": "Collaborator removed successfully"
        }), 200

    finally:
        conn.close()

