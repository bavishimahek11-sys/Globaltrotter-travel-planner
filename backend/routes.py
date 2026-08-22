from flask import Blueprint, jsonify, request
from database import get_db_connection
import secrets
from datetime import datetime
import urllib.request
import urllib.parse
import json

api = Blueprint("api", __name__)


# --------------------------------------------------
# GEOCODING HELPER (NOMINATIM)
# --------------------------------------------------

def geocode_location(location):
    """
    Geocodes a location query using OpenStreetMap Nominatim.
    Returns (latitude, longitude) as floats if found, or (None, None) if not found / error.
    Does not guess or use fake coordinates.
    """
    if not location or not str(location).strip():
        return None, None
    try:
        query = str(location).strip()
        encoded_query = urllib.parse.quote(query)
        url = f"https://nominatim.openstreetmap.org/search?q={encoded_query}&format=json&limit=1"
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "GlobalTrotter-TravelPlanner/1.0 (Hackathon Prototype)"
            }
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                raw = response.read().decode("utf-8")
                data = json.loads(raw)
                if data and isinstance(data, list) and len(data) > 0:
                    lat = float(data[0]["lat"])
                    lon = float(data[0]["lon"])
                    return lat, lon
    except Exception as e:
        print(f"Geocoding error for '{location}': {e}")
    return None, None



# --------------------------------------------------
# PERMISSION & ACCESS HELPERS
# --------------------------------------------------

def get_request_user_id(data=None):
    if data and isinstance(data, dict) and "user_id" in data and data["user_id"] is not None:
        try:
            return int(data["user_id"])
        except (ValueError, TypeError):
            pass
    if request.args.get("user_id"):
        try:
            return int(request.args.get("user_id"))
        except (ValueError, TypeError):
            pass
    if request.headers.get("X-User-Id"):
        try:
            return int(request.headers.get("X-User-Id"))
        except (ValueError, TypeError):
            pass
    return None


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
    """, (trip_id, user_id)).fetchone()

    if collaborator:
        return collaborator["role"].lower()

    return None


def require_trip_access(conn, trip_id, user_id):
    permission = get_trip_permission(conn, trip_id, user_id)

    if permission is None:
        return None, jsonify({
            "error": "You do not have access to this trip"
        }), 403

    return permission, None, None


def require_editor_access(conn, trip_id, user_id):
    permission = get_trip_permission(conn, trip_id, user_id)

    if permission is None:
        return None, jsonify({
            "error": "You do not have access to this trip"
        }), 403

    if permission not in ["owner", "editor"]:
        return None, jsonify({
            "error": "You do not have permission to modify this trip"
        }), 403

    return permission, None, None


def require_owner_access(conn, trip_id, user_id):
    permission = get_trip_permission(conn, trip_id, user_id)

    if permission is None:
        return None, jsonify({
            "error": "You do not have access to this trip"
        }), 403

    if permission != "owner":
        return None, jsonify({
            "error": "Only the trip owner can perform this action"
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
    }), 200


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

    email = email.strip().lower()
    name = name.strip()

    conn = get_db_connection()
    try:
        existing_user = conn.execute(
            "SELECT id FROM users WHERE LOWER(email) = ?",
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
# LOGIN USER
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

    email = email.strip().lower()

    conn = get_db_connection()
    try:
        user = conn.execute("""
            SELECT id, name, email, password
            FROM users
            WHERE LOWER(email) = ?
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
# TRIPS (CRUD)
# --------------------------------------------------

@api.route("/api/trips", methods=["POST"])
def create_trip():
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    user_id = data.get("user_id") or get_request_user_id(data)
    name = data.get("name") or data.get("title")
    start_date = data.get("start_date") or data.get("startDate")
    end_date = data.get("end_date") or data.get("endDate")
    budget = data.get("budget", 0)
    from_city = data.get("fromCity")
    to_city = data.get("toCity") or data.get("destination")
    added_stops = data.get("addedStops") or []

    if not user_id:
        return jsonify({
            "error": "user_id is required"
        }), 400

    if not name:
        if from_city and to_city:
            name = f"Trip from {from_city} to {to_city}"
        elif to_city:
            name = f"Trip to {to_city}"
        else:
            return jsonify({
                "error": "Trip name or title is required"
            }), 400

    try:
        budget = float(budget) if budget is not None else 0.0
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

        # Geocode starting and destination cities
        start_lat = None
        start_lng = None
        dest_lat = None
        dest_lng = None

        if from_city:
            start_lat, start_lng = geocode_location(from_city)

        if to_city:
            dest_lat, dest_lng = geocode_location(to_city)

        cursor = conn.execute("""
            INSERT INTO trips (
                user_id,
                name,
                start_date,
                end_date,
                budget,
                start_latitude,
                start_longitude,
                destination_latitude,
                destination_longitude
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            name,
            start_date,
            end_date,
            budget,
            start_lat,
            start_lng,
            dest_lat,
            dest_lng
        ))

        conn.commit()
        trip_id = cursor.lastrowid

        # Populate initial destinations / stops with coordinates
        if from_city:
            conn.execute("""
                INSERT INTO destinations (trip_id, name, city, visit_date, latitude, longitude)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (trip_id, from_city, from_city, start_date, start_lat, start_lng))

        if isinstance(added_stops, list):
            for stop in added_stops:
                stop_city = stop.get("city") if isinstance(stop, dict) else str(stop)
                stop_notes = stop.get("description") if isinstance(stop, dict) else ""
                if stop_city and stop_city != from_city and stop_city != to_city:
                    stop_lat, stop_lng = geocode_location(stop_city)
                    conn.execute("""
                        INSERT INTO destinations (trip_id, name, city, notes, latitude, longitude)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (trip_id, stop_city, stop_city, stop_notes, stop_lat, stop_lng))

        if to_city and to_city != from_city:
            conn.execute("""
                INSERT INTO destinations (trip_id, name, city, visit_date, latitude, longitude)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (trip_id, to_city, to_city, end_date, dest_lat, dest_lng))

        conn.commit()

        return jsonify({
            "message": "Trip created successfully",
            "trip": {
                "id": trip_id,
                "user_id": user_id,
                "name": name,
                "title": name,
                "start_date": start_date,
                "startDate": start_date,
                "end_date": end_date,
                "endDate": end_date,
                "budget": budget,
                "start_latitude": start_lat,
                "start_longitude": start_lng,
                "destination_latitude": dest_lat,
                "destination_longitude": dest_lng,
                "startLatitude": start_lat,
                "startLongitude": start_lng,
                "destinationLatitude": dest_lat,
                "destinationLongitude": dest_lng
            }
        }), 201
    finally:
        conn.close()


@api.route("/api/trips", methods=["GET"])
def get_trips():
    user_id = get_request_user_id()
    conn = get_db_connection()
    try:
        if user_id:
            trips = conn.execute("""
                SELECT DISTINCT
                    trips.id,
                    trips.user_id,
                    trips.name,
                    trips.start_date,
                    trips.end_date,
                    trips.budget,
                    trips.start_latitude,
                    trips.start_longitude,
                    trips.destination_latitude,
                    trips.destination_longitude,
                    trips.created_at
                FROM trips
                LEFT JOIN trip_collaborators ON trips.id = trip_collaborators.trip_id
                WHERE trips.user_id = ? OR trip_collaborators.user_id = ?
                ORDER BY trips.created_at DESC
            """, (user_id, user_id)).fetchall()
        else:
            trips = conn.execute("""
                SELECT
                    id,
                    user_id,
                    name,
                    start_date,
                    end_date,
                    budget,
                    start_latitude,
                    start_longitude,
                    destination_latitude,
                    destination_longitude,
                    created_at
                FROM trips
                ORDER BY created_at DESC
            """).fetchall()

        trip_list = []
        for trip in trips:
            t_id = trip["id"]
            act_count = conn.execute(
                "SELECT COUNT(*) AS count FROM itinerary WHERE trip_id = ?",
                (t_id,)
            ).fetchone()["count"]

            destinations = conn.execute("""
                SELECT id, trip_id, name, city, country, visit_date, notes, latitude, longitude
                FROM destinations
                WHERE trip_id = ?
                ORDER BY id ASC
            """, (t_id,)).fetchall()

            from_city = destinations[0]["city"] or destinations[0]["name"] if destinations else ""
            to_city = destinations[-1]["city"] or destinations[-1]["name"] if destinations else ""
            destination = to_city or trip["name"]

            start_date = trip["start_date"] or ""
            end_date = trip["end_date"] or ""
            duration = "Flexible"
            if start_date and end_date:
                try:
                    d1 = datetime.strptime(start_date, "%Y-%m-%d")
                    d2 = datetime.strptime(end_date, "%Y-%m-%d")
                    days = (d2 - d1).days + 1
                    if days > 0:
                        duration = f"{days} {'day' if days == 1 else 'days'}"
                except Exception:
                    pass

            start_lat = trip["start_latitude"] if "start_latitude" in trip.keys() else None
            start_lng = trip["start_longitude"] if "start_longitude" in trip.keys() else None
            dest_lat = trip["destination_latitude"] if "destination_latitude" in trip.keys() else None
            dest_lng = trip["destination_longitude"] if "destination_longitude" in trip.keys() else None

            trip_list.append({
                "id": trip["id"],
                "user_id": trip["user_id"],
                "name": trip["name"],
                "title": trip["name"],
                "destination": destination,
                "fromCity": from_city,
                "toCity": to_city,
                "start_date": start_date,
                "startDate": start_date,
                "end_date": end_date,
                "endDate": end_date,
                "budget": float(trip["budget"] or 0),
                "duration": duration,
                "start_latitude": start_lat,
                "start_longitude": start_lng,
                "destination_latitude": dest_lat,
                "destination_longitude": dest_lng,
                "startLatitude": start_lat,
                "startLongitude": start_lng,
                "destinationLatitude": dest_lat,
                "destinationLongitude": dest_lng,
                "created_at": trip["created_at"],
                "itinerary": [0] * act_count,
                "addedStops": [dict(d) for d in destinations]
            })

        return jsonify(trip_list), 200
    finally:
        conn.close()


@api.route("/api/trips/<int:trip_id>", methods=["GET"])
def get_single_trip(trip_id):
    conn = get_db_connection()
    try:
        trip = conn.execute("""
            SELECT
                id,
                user_id,
                name,
                start_date,
                end_date,
                budget,
                start_latitude,
                start_longitude,
                destination_latitude,
                destination_longitude,
                created_at
            FROM trips
            WHERE id = ?
        """, (trip_id,)).fetchone()

        if not trip:
            return jsonify({
                "error": "Trip not found"
            }), 404

        user_id = get_request_user_id()
        role = "Viewer"
        if user_id:
            perm = get_trip_permission(conn, trip_id, user_id)
            if perm == "owner":
                role = "Owner"
            elif perm == "editor":
                role = "Editor"
            elif perm == "viewer":
                role = "Viewer"

        # Destinations
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
            ORDER BY id ASC
        """, (trip_id,)).fetchall()

        # Itinerary
        itinerary = conn.execute("""
            SELECT
                itinerary.id,
                itinerary.trip_id,
                itinerary.destination_id,
                itinerary.activity,
                itinerary.activity_date,
                itinerary.activity_date AS date,
                itinerary.start_time,
                itinerary.start_time AS time,
                itinerary.end_time,
                itinerary.notes,
                COALESCE(destinations.name, destinations.city, '') AS location,
                destinations.name AS destination_name,
                destinations.city AS destination_city,
                destinations.country AS destination_country,
                destinations.latitude,
                destinations.longitude,
                destinations.latitude AS lat,
                destinations.longitude AS lng
            FROM itinerary
            LEFT JOIN destinations ON itinerary.destination_id = destinations.id
            WHERE itinerary.trip_id = ?
            ORDER BY itinerary.activity_date ASC, itinerary.start_time ASC, itinerary.id ASC
        """, (trip_id,)).fetchall()

        # Expenses
        expenses = conn.execute("""
            SELECT
                id,
                trip_id,
                category,
                description,
                description AS title,
                amount,
                expense_date,
                expense_date AS date,
                created_at
            FROM expenses
            WHERE trip_id = ?
            ORDER BY expense_date ASC, id ASC
        """, (trip_id,)).fetchall()

        # Collaborators
        owner = conn.execute("""
            SELECT id, name, email
            FROM users
            WHERE id = ?
        """, (trip["user_id"],)).fetchone()

        collabs = conn.execute("""
            SELECT
                trip_collaborators.id,
                users.id AS user_id,
                users.name,
                users.email,
                trip_collaborators.role
            FROM trip_collaborators
            JOIN users ON trip_collaborators.user_id = users.id
            WHERE trip_collaborators.trip_id = ?
            ORDER BY users.name ASC
        """, (trip_id,)).fetchall()

        collaborator_list = []
        if owner:
            collaborator_list.append({
                "id": owner["id"],
                "user_id": owner["id"],
                "name": owner["name"],
                "email": owner["email"],
                "role": "Owner"
            })
        for c in collabs:
            collaborator_list.append({
                "id": c["id"],
                "user_id": c["user_id"],
                "name": c["name"],
                "email": c["email"],
                "role": c["role"].capitalize()
            })

        # Share Token
        share_link = conn.execute("""
            SELECT share_token
            FROM trip_share_links
            WHERE trip_id = ?
        """, (trip_id,)).fetchone()
        share_token = share_link["share_token"] if share_link else None
        share_url = f"/shared-trip.html?token={share_token}" if share_token else None

        dest_list = [dict(d) for d in destinations]
        from_city = dest_list[0]["city"] or dest_list[0]["name"] if dest_list else ""
        to_city = dest_list[-1]["city"] or dest_list[-1]["name"] if dest_list else ""

        start_date = trip["start_date"] or ""
        end_date = trip["end_date"] or ""
        duration = "Flexible"
        if start_date and end_date:
            try:
                d1 = datetime.strptime(start_date, "%Y-%m-%d")
                d2 = datetime.strptime(end_date, "%Y-%m-%d")
                days = (d2 - d1).days + 1
                if days > 0:
                    duration = f"{days} {'day' if days == 1 else 'days'}"
            except Exception:
                pass

        start_lat = trip["start_latitude"] if "start_latitude" in trip.keys() else None
        start_lng = trip["start_longitude"] if "start_longitude" in trip.keys() else None
        dest_lat = trip["destination_latitude"] if "destination_latitude" in trip.keys() else None
        dest_lng = trip["destination_longitude"] if "destination_longitude" in trip.keys() else None

        # On-demand geocoding for trips created earlier or missing coordinates
        updated_db = False
        if from_city and (start_lat is None or start_lng is None):
            s_lat, s_lng = geocode_location(from_city)
            if s_lat is not None and s_lng is not None:
                start_lat, start_lng = s_lat, s_lng
                conn.execute("""
                    UPDATE trips
                    SET start_latitude = ?, start_longitude = ?
                    WHERE id = ?
                """, (start_lat, start_lng, trip_id))
                updated_db = True

        if to_city and (dest_lat is None or dest_lng is None):
            d_lat, d_lng = geocode_location(to_city)
            if d_lat is not None and d_lng is not None:
                dest_lat, dest_lng = d_lat, d_lng
                conn.execute("""
                    UPDATE trips
                    SET destination_latitude = ?, destination_longitude = ?
                    WHERE id = ?
                """, (dest_lat, dest_lng, trip_id))
                updated_db = True

        for d in dest_list:
            if d.get("latitude") is None or d.get("longitude") is None:
                city_name = d.get("city") or d.get("name")
                if city_name:
                    c_lat, c_lng = geocode_location(city_name)
                    if c_lat is not None and c_lng is not None:
                        d["latitude"] = c_lat
                        d["longitude"] = c_lng
                        conn.execute("""
                            UPDATE destinations
                            SET latitude = ?, longitude = ?
                            WHERE id = ?
                        """, (c_lat, c_lng, d["id"]))
                        updated_db = True

        if updated_db:
            conn.commit()

        trip_dict = {
            "id": trip["id"],
            "user_id": trip["user_id"],
            "name": trip["name"],
            "title": trip["name"],
            "destination": to_city or trip["name"],
            "fromCity": from_city,
            "toCity": to_city,
            "start_date": start_date,
            "startDate": start_date,
            "end_date": end_date,
            "endDate": end_date,
            "budget": float(trip["budget"] or 0),
            "duration": duration,
            "start_latitude": start_lat,
            "start_longitude": start_lng,
            "destination_latitude": dest_lat,
            "destination_longitude": dest_lng,
            "startLatitude": start_lat,
            "startLongitude": start_lng,
            "destinationLatitude": dest_lat,
            "destinationLongitude": dest_lng,
            "destinations": dest_list,
            "addedStops": dest_list,
            "itinerary": [dict(i) for i in itinerary],
            "expenses": [dict(e) for e in expenses],
            "collaborators": collaborator_list,
            "currentUserRole": role,
            "shareToken": share_token,
            "shareUrl": share_url
        }

        return jsonify(trip_dict), 200
    finally:
        conn.close()


@api.route("/api/trips/<int:trip_id>", methods=["PUT"])
def update_trip(trip_id):
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    user_id = data.get("user_id") or get_request_user_id(data)

    if user_id is None:
        return jsonify({
            "error": "User ID is required"
        }), 400

    name = data.get("name") or data.get("title")
    start_date = data.get("start_date") or data.get("startDate")
    end_date = data.get("end_date") or data.get("endDate")
    budget = data.get("budget")

    if not name:
        return jsonify({
            "error": "Trip name is required"
        }), 400

    conn = get_db_connection()
    try:
        permission, error_response, status = require_owner_access(
            conn,
            trip_id,
            int(user_id)
        )

        if error_response:
            return error_response, status

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
    user_id = data.get("user_id") or get_request_user_id(data)

    if user_id is None:
        return jsonify({
            "error": "User ID is required"
        }), 400

    conn = get_db_connection()
    try:
        permission, error_response, status = require_owner_access(
            conn,
            trip_id,
            int(user_id)
        )

        if error_response:
            return error_response, status

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


# --------------------------------------------------
# SMART STOPS (VERIFIED ROUTE CORRIDORS)
# --------------------------------------------------

CORRIDOR_STOPS = {
    ("ahmedabad", "mumbai"): [
        {
            "city": "Vadodara",
            "category": "Heritage & Culture",
            "duration": "2-3 hours",
            "description": "Historic city famous for Laxmi Vilas Palace, Sayaji Baug, and authentic Gujarati cuisine."
        },
        {
            "city": "Bharuch",
            "category": "Scenic River Stop",
            "duration": "1-2 hours",
            "description": "Ancient port city situated on the banks of the Narmada River, famous for the historic Golden Bridge."
        },
        {
            "city": "Surat",
            "category": "Food & Textile Hub",
            "duration": "3-4 hours",
            "description": "Famous for Dumas Beach, Surat Castle, rich textile markets, and renowned street delicacies."
        },
        {
            "city": "Vapi",
            "category": "Coastal Gateway",
            "duration": "2-3 hours",
            "description": "Charming coastal gateway with Portuguese colonial forts, beaches, and seaside promenades in nearby Daman."
        }
    ],
    ("mumbai", "ahmedabad"): [
        {
            "city": "Vapi",
            "category": "Coastal Gateway",
            "duration": "2-3 hours",
            "description": "Charming coastal gateway with Portuguese colonial forts, beaches, and seaside promenades in nearby Daman."
        },
        {
            "city": "Surat",
            "category": "Food & Textile Hub",
            "duration": "3-4 hours",
            "description": "Famous for Dumas Beach, Surat Castle, rich textile markets, and renowned street delicacies."
        },
        {
            "city": "Bharuch",
            "category": "Scenic River Stop",
            "duration": "1-2 hours",
            "description": "Ancient port city situated on the banks of the Narmada River, famous for the historic Golden Bridge."
        },
        {
            "city": "Vadodara",
            "category": "Heritage & Culture",
            "duration": "2-3 hours",
            "description": "Historic city famous for Laxmi Vilas Palace, Sayaji Baug, and authentic Gujarati cuisine."
        }
    ],
    ("delhi", "jaipur"): [
        {
            "city": "Gurugram",
            "category": "Urban & Dining Hub",
            "duration": "1-2 hours",
            "description": "Modern metropolitan hub with Cyber Hub dining, cultural centers, and popular highway stopovers."
        },
        {
            "city": "Neemrana",
            "category": "Heritage Fort",
            "duration": "2-3 hours",
            "description": "Famous for the magnificent 15th-century Neemrana Fort Palace and historic multi-tier stepwell (Baori)."
        },
        {
            "city": "Behror",
            "category": "Highway Craft Stop",
            "duration": "1-2 hours",
            "description": "Popular midway highway junction known for traditional Rajasthani dhabas and regional handicrafts."
        },
        {
            "city": "Shahpura",
            "category": "Craft & Heritage",
            "duration": "1-2 hours",
            "description": "Known for historic havelis, artisanal phad paintings, and tranquil royal lakes."
        }
    ],
    ("jaipur", "delhi"): [
        {
            "city": "Shahpura",
            "category": "Craft & Heritage",
            "duration": "1-2 hours",
            "description": "Known for historic havelis, artisanal phad paintings, and tranquil royal lakes."
        },
        {
            "city": "Behror",
            "category": "Highway Craft Stop",
            "duration": "1-2 hours",
            "description": "Popular midway highway junction known for traditional Rajasthani dhabas and regional handicrafts."
        },
        {
            "city": "Neemrana",
            "category": "Heritage Fort",
            "duration": "2-3 hours",
            "description": "Famous for the magnificent 15th-century Neemrana Fort Palace and historic multi-tier stepwell (Baori)."
        },
        {
            "city": "Gurugram",
            "category": "Urban & Dining Hub",
            "duration": "1-2 hours",
            "description": "Modern metropolitan hub with Cyber Hub dining, cultural centers, and popular highway stopovers."
        }
    ],
    ("mumbai", "goa"): [
        {
            "city": "Lonavala",
            "category": "Hill Station",
            "duration": "2-3 hours",
            "description": "Scenic Western Ghats hill station famous for Tiger's Leap, Karla Caves, Bhushi Dam, and chikki."
        },
        {
            "city": "Pune",
            "category": "Cultural & Tech Hub",
            "duration": "3-4 hours",
            "description": "Historic Maratha capital featuring Shaniwar Wada, Aga Khan Palace, and vibrant cafe culture."
        },
        {
            "city": "Satara",
            "category": "Scenic Heritage",
            "duration": "1-2 hours",
            "description": "Gateway to the UNESCO World Heritage Kaas Valley of Flowers and historic Ajinkyatara Fort."
        },
        {
            "city": "Kolhapur",
            "category": "Temple & Cuisine",
            "duration": "2-3 hours",
            "description": "Renowned for the ancient Mahalakshmi Temple, historic Rankala Lake, and traditional Kolhapuri cuisine."
        },
        {
            "city": "Ratnagiri",
            "category": "Coastal Konkan",
            "duration": "3-4 hours",
            "description": "Scenic coastal haven famous for Alphonso mangoes, Jaigad Fort, and pristine Konkan beaches."
        }
    ],
    ("goa", "mumbai"): [
        {
            "city": "Ratnagiri",
            "category": "Coastal Konkan",
            "duration": "3-4 hours",
            "description": "Scenic coastal haven famous for Alphonso mangoes, Jaigad Fort, and pristine Konkan beaches."
        },
        {
            "city": "Kolhapur",
            "category": "Temple & Cuisine",
            "duration": "2-3 hours",
            "description": "Renowned for the ancient Mahalakshmi Temple, historic Rankala Lake, and traditional Kolhapuri cuisine."
        },
        {
            "city": "Satara",
            "category": "Scenic Heritage",
            "duration": "1-2 hours",
            "description": "Gateway to the UNESCO World Heritage Kaas Valley of Flowers and historic Ajinkyatara Fort."
        },
        {
            "city": "Pune",
            "category": "Cultural & Tech Hub",
            "duration": "3-4 hours",
            "description": "Historic Maratha capital featuring Shaniwar Wada, Aga Khan Palace, and vibrant cafe culture."
        },
        {
            "city": "Lonavala",
            "category": "Hill Station",
            "duration": "2-3 hours",
            "description": "Scenic Western Ghats hill station famous for Tiger's Leap, Karla Caves, Bhushi Dam, and chikki."
        }
    ],
    ("bangalore", "chennai"): [
        {
            "city": "Hosur",
            "category": "Garden Gateway",
            "duration": "1-2 hours",
            "description": "Border hill town renowned for floriculture, Chandira Choodeswarar Temple, and pleasant weather."
        },
        {
            "city": "Ambur",
            "category": "Cuisine & Heritage",
            "duration": "1-2 hours",
            "description": "Historic town on the Palar River basin celebrated for its world-renowned culinary heritage and Ambur biryani."
        },
        {
            "city": "Vellore",
            "category": "Historic Fort",
            "duration": "2-3 hours",
            "description": "Home to the monumental 16th-century granite Vellore Fort and the glittering Sripuram Golden Temple."
        },
        {
            "city": "Kanchipuram",
            "category": "Temple City",
            "duration": "2-3 hours",
            "description": "The 'City of Thousand Temples' famous for ancient Dravidian temple architecture and handcrafted silk."
        }
    ],
    ("chennai", "bangalore"): [
        {
            "city": "Kanchipuram",
            "category": "Temple City",
            "duration": "2-3 hours",
            "description": "The 'City of Thousand Temples' famous for ancient Dravidian temple architecture and handcrafted silk."
        },
        {
            "city": "Vellore",
            "category": "Historic Fort",
            "duration": "2-3 hours",
            "description": "Home to the monumental 16th-century granite Vellore Fort and the glittering Sripuram Golden Temple."
        },
        {
            "city": "Ambur",
            "category": "Cuisine & Heritage",
            "duration": "1-2 hours",
            "description": "Historic town on the Palar River basin celebrated for its world-renowned culinary heritage and Ambur biryani."
        },
        {
            "city": "Hosur",
            "category": "Garden Gateway",
            "duration": "1-2 hours",
            "description": "Border hill town renowned for floriculture, Chandira Choodeswarar Temple, and pleasant weather."
        }
    ],
    ("mumbai", "pune"): [
        {
            "city": "Navi Mumbai",
            "category": "Urban Waterfront",
            "duration": "1 hour",
            "description": "Modern planned city with Central Park, Kharghar Hills waterfalls, and scenic expressway viewpoints."
        },
        {
            "city": "Lonavala",
            "category": "Scenic Hill Station",
            "duration": "2-3 hours",
            "description": "Misty Western Ghats mountain pass featuring Bhushi Dam, Karla Caves, and traditional chikki stalls."
        },
        {
            "city": "Khandala",
            "category": "Valley Lookouts",
            "duration": "1-2 hours",
            "description": "Famous for Duke's Nose cliff edge, picturesque valley views, and misty waterfalls."
        }
    ],
    ("pune", "mumbai"): [
        {
            "city": "Khandala",
            "category": "Valley Lookouts",
            "duration": "1-2 hours",
            "description": "Famous for Duke's Nose cliff edge, picturesque valley views, and misty waterfalls."
        },
        {
            "city": "Lonavala",
            "category": "Scenic Hill Station",
            "duration": "2-3 hours",
            "description": "Misty Western Ghats mountain pass featuring Bhushi Dam, Karla Caves, and traditional chikki stalls."
        },
        {
            "city": "Navi Mumbai",
            "category": "Urban Waterfront",
            "duration": "1 hour",
            "description": "Modern planned city with Central Park, Kharghar Hills waterfalls, and scenic expressway viewpoints."
        }
    ],
    ("delhi", "agra"): [
        {
            "city": "Faridabad",
            "category": "Cultural Heritage",
            "duration": "1 hour",
            "description": "Home to the historic 10th-century Surajkund reservoir and serene Badkhal Lake."
        },
        {
            "city": "Mathura",
            "category": "Heritage & Ghats",
            "duration": "2-3 hours",
            "description": "Ancient sacred heritage city along the Yamuna River rich in history, temples, and vibrant ghats."
        },
        {
            "city": "Vrindavan",
            "category": "Heritage Temple Town",
            "duration": "2 hours",
            "description": "Celebrated temple town with iconic architectural landmarks like Prem Mandir and Banke Bihari Temple."
        }
    ],
    ("agra", "delhi"): [
        {
            "city": "Vrindavan",
            "category": "Heritage Temple Town",
            "duration": "2 hours",
            "description": "Celebrated temple town with iconic architectural landmarks like Prem Mandir and Banke Bihari Temple."
        },
        {
            "city": "Mathura",
            "category": "Heritage & Ghats",
            "duration": "2-3 hours",
            "description": "Ancient sacred heritage city along the Yamuna River rich in history, temples, and vibrant ghats."
        },
        {
            "city": "Faridabad",
            "category": "Cultural Heritage",
            "duration": "1 hour",
            "description": "Home to the historic 10th-century Surajkund reservoir and serene Badkhal Lake."
        }
    ]
}

@api.route("/api/smart-stops", methods=["GET"])
def get_smart_stops():
    from_city = (request.args.get("from") or request.args.get("fromCity") or request.args.get("origin") or "").strip().lower()
    to_city = (request.args.get("to") or request.args.get("toCity") or request.args.get("destination") or "").strip().lower()

    if not from_city or not to_city:
        return jsonify([]), 200

    # Lookup direct corridor match
    stops = CORRIDOR_STOPS.get((from_city, to_city))
    if stops:
        return jsonify(stops), 200

    # Lookup partial match on city base names
    for (src, dst), suggestions in CORRIDOR_STOPS.items():
        if (src in from_city or from_city in src) and (dst in to_city or to_city in dst):
            return jsonify(suggestions), 200

    # Return empty list when no verified stops exist for this route
    return jsonify([]), 200


# --------------------------------------------------
# DESTINATIONS (CRUD)
# --------------------------------------------------

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
            "destinations": [dict(d) for d in destinations]
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

    user_id = data.get("user_id") or get_request_user_id(data)
    name = data.get("name")
    city = data.get("city")
    country = data.get("country")
    visit_date = data.get("visit_date")
    notes = data.get("notes")
    latitude = data.get("latitude") if data.get("latitude") is not None else data.get("lat")
    longitude = data.get("longitude") if data.get("longitude") is not None else data.get("lng")

    if not name:
        return jsonify({
            "error": "Destination name is required"
        }), 400

    if latitude is not None and str(latitude).strip() != "":
        try:
            latitude = float(latitude)
            if not -90 <= latitude <= 90:
                return jsonify({"error": "Latitude must be between -90 and 90"}), 400
        except (TypeError, ValueError):
            return jsonify({"error": "Latitude must be a number"}), 400
    else:
        latitude = None

    if longitude is not None and str(longitude).strip() != "":
        try:
            longitude = float(longitude)
            if not -180 <= longitude <= 180:
                return jsonify({"error": "Longitude must be between -180 and 180"}), 400
        except (TypeError, ValueError):
            return jsonify({"error": "Longitude must be a number"}), 400
    else:
        longitude = None

    conn = get_db_connection()
    try:
        if user_id:
            permission, error_response, status = require_editor_access(
                conn,
                trip_id,
                int(user_id)
            )
            if error_response:
                return error_response, status

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


@api.route("/api/destinations/<int:destination_id>", methods=["PUT"])
@api.route("/api/trips/<int:trip_id>/destinations/<int:destination_id>", methods=["PUT"])
def update_destination(destination_id, trip_id=None):
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    user_id = data.get("user_id") or get_request_user_id(data)

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

        actual_trip_id = destination["trip_id"]

        if user_id:
            permission, error_response, status = require_editor_access(
                conn,
                actual_trip_id,
                int(user_id)
            )
            if error_response:
                return error_response, status

        name = data.get("name")
        city = data.get("city")
        country = data.get("country")
        visit_date = data.get("visit_date")
        notes = data.get("notes")
        latitude = data.get("latitude") if data.get("latitude") is not None else data.get("lat")
        longitude = data.get("longitude") if data.get("longitude") is not None else data.get("lng")

        if latitude is not None and str(latitude).strip() != "":
            try:
                latitude = float(latitude)
            except (TypeError, ValueError):
                return jsonify({"error": "Latitude must be a number"}), 400
        else:
            latitude = None

        if longitude is not None and str(longitude).strip() != "":
            try:
                longitude = float(longitude)
            except (TypeError, ValueError):
                return jsonify({"error": "Longitude must be a number"}), 400
        else:
            longitude = None

        conn.execute("""
            UPDATE destinations
            SET name = COALESCE(?, name),
                city = COALESCE(?, city),
                country = COALESCE(?, country),
                visit_date = COALESCE(?, visit_date),
                notes = COALESCE(?, notes),
                latitude = COALESCE(?, latitude),
                longitude = COALESCE(?, longitude)
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


@api.route("/api/destinations/<int:destination_id>", methods=["DELETE"])
@api.route("/api/trips/<int:trip_id>/destinations/<int:destination_id>", methods=["DELETE"])
def delete_destination(destination_id, trip_id=None):
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id") or get_request_user_id(data)

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

        actual_trip_id = destination["trip_id"]

        if user_id:
            permission, error_response, status = require_editor_access(
                conn,
                actual_trip_id,
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


# --------------------------------------------------
# ITINERARY (CRUD)
# --------------------------------------------------

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
                itinerary.activity_date AS date,
                itinerary.start_time,
                itinerary.start_time AS time,
                itinerary.end_time,
                itinerary.notes,
                COALESCE(destinations.name, destinations.city, '') AS location,
                destinations.name AS destination_name,
                destinations.city AS destination_city,
                destinations.country AS destination_country,
                destinations.latitude,
                destinations.longitude,
                destinations.latitude AS lat,
                destinations.longitude AS lng
            FROM itinerary
            LEFT JOIN destinations ON itinerary.destination_id = destinations.id
            WHERE itinerary.trip_id = ?
            ORDER BY
                itinerary.activity_date ASC,
                itinerary.start_time ASC,
                itinerary.id ASC
        """, (trip_id,)).fetchall()

        return jsonify({
            "itinerary": [dict(item) for item in itinerary]
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

    user_id = data.get("user_id") or get_request_user_id(data)
    activity = data.get("activity") or data.get("name")
    destination_id = data.get("destination_id")
    location = data.get("location")
    activity_date = data.get("activity_date") or data.get("date")
    start_time = data.get("start_time") or data.get("time")
    end_time = data.get("end_time")
    notes = data.get("notes")
    latitude = data.get("latitude") if data.get("latitude") is not None else data.get("lat")
    longitude = data.get("longitude") if data.get("longitude") is not None else data.get("lng")

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
        permission, error_response, status = require_editor_access(
            conn,
            trip_id,
            int(user_id)
        )

        if error_response:
            return error_response, status

        # Handle destination creation if location or coordinates provided
        if destination_id is None and (location or (latitude is not None and longitude is not None)):
            dest_name = location or "Activity Location"
            lat_val = None
            lng_val = None
            if latitude is not None and str(latitude).strip() != "":
                try:
                    lat_val = float(latitude)
                except (ValueError, TypeError):
                    pass
            if longitude is not None and str(longitude).strip() != "":
                try:
                    lng_val = float(longitude)
                except (ValueError, TypeError):
                    pass

            dest_cursor = conn.execute("""
                INSERT INTO destinations (
                    trip_id,
                    name,
                    city,
                    visit_date,
                    notes,
                    latitude,
                    longitude
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (trip_id, dest_name, dest_name, activity_date, notes, lat_val, lng_val))
            destination_id = dest_cursor.lastrowid
        elif destination_id is not None:
            # If coordinates are provided, update destination
            if latitude is not None and longitude is not None:
                try:
                    lat_val = float(latitude)
                    lng_val = float(longitude)
                    conn.execute("""
                        UPDATE destinations
                        SET latitude = ?, longitude = ?
                        WHERE id = ?
                    """, (lat_val, lng_val, destination_id))
                except (ValueError, TypeError):
                    pass

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
                itinerary.activity_date AS date,
                itinerary.start_time,
                itinerary.start_time AS time,
                itinerary.end_time,
                itinerary.notes,
                COALESCE(destinations.name, destinations.city, '') AS location,
                destinations.name AS destination_name,
                destinations.city AS destination_city,
                destinations.country AS destination_country,
                destinations.latitude,
                destinations.longitude,
                destinations.latitude AS lat,
                destinations.longitude AS lng
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


@api.route("/api/trips/<int:trip_id>/itinerary/<int:itinerary_id>", methods=["PUT"])
@api.route("/api/itinerary/<int:itinerary_id>", methods=["PUT"])
def update_itinerary_item(itinerary_id, trip_id=None):
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    user_id = data.get("user_id") or get_request_user_id(data)

    if user_id is None:
        return jsonify({
            "error": "User ID is required"
        }), 400

    conn = get_db_connection()
    try:
        item = conn.execute("""
            SELECT trip_id, destination_id
            FROM itinerary
            WHERE id = ?
        """, (itinerary_id,)).fetchone()

        if not item:
            return jsonify({
                "error": "Itinerary item not found"
            }), 404

        actual_trip_id = item["trip_id"]
        permission, error_response, status = require_editor_access(
            conn,
            actual_trip_id,
            int(user_id)
        )

        if error_response:
            return error_response, status

        activity = data.get("activity") or data.get("name")
        destination_id = data.get("destination_id", item["destination_id"])
        location = data.get("location")
        activity_date = data.get("activity_date") or data.get("date")
        start_time = data.get("start_time") or data.get("time")
        end_time = data.get("end_time")
        notes = data.get("notes")
        latitude = data.get("latitude") if data.get("latitude") is not None else data.get("lat")
        longitude = data.get("longitude") if data.get("longitude") is not None else data.get("lng")

        if not activity:
            return jsonify({
                "error": "Activity is required"
            }), 400

        lat_val = None
        lng_val = None
        if latitude is not None and str(latitude).strip() != "":
            try:
                lat_val = float(latitude)
            except (ValueError, TypeError):
                pass
        if longitude is not None and str(longitude).strip() != "":
            try:
                lng_val = float(longitude)
            except (ValueError, TypeError):
                pass

        if destination_id:
            conn.execute("""
                UPDATE destinations
                SET name = COALESCE(?, name),
                    latitude = COALESCE(?, latitude),
                    longitude = COALESCE(?, longitude)
                WHERE id = ?
            """, (location, lat_val, lng_val, destination_id))
        elif location or lat_val is not None:
            dest_name = location or "Activity Location"
            dest_cur = conn.execute("""
                INSERT INTO destinations (
                    trip_id,
                    name,
                    city,
                    visit_date,
                    notes,
                    latitude,
                    longitude
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (actual_trip_id, dest_name, dest_name, activity_date, notes, lat_val, lng_val))
            destination_id = dest_cur.lastrowid

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
                itinerary.activity_date AS date,
                itinerary.start_time,
                itinerary.start_time AS time,
                itinerary.end_time,
                itinerary.notes,
                COALESCE(destinations.name, destinations.city, '') AS location,
                destinations.name AS destination_name,
                destinations.latitude,
                destinations.longitude,
                destinations.latitude AS lat,
                destinations.longitude AS lng
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


@api.route("/api/trips/<int:trip_id>/itinerary/<int:itinerary_id>", methods=["DELETE"])
@api.route("/api/itinerary/<int:itinerary_id>", methods=["DELETE"])
def delete_itinerary_item(itinerary_id, trip_id=None):
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id") or get_request_user_id(data)

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

        actual_trip_id = item["trip_id"]
        permission, error_response, status = require_editor_access(
            conn,
            actual_trip_id,
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


# --------------------------------------------------
# EXPENSES & BUDGET (CRUD)
# --------------------------------------------------

@api.route("/api/trips/<int:trip_id>/expenses", methods=["GET"])
def get_expenses(trip_id):
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

        expenses = conn.execute("""
            SELECT
                id,
                trip_id,
                category,
                description,
                description AS title,
                amount,
                expense_date,
                expense_date AS date,
                created_at
            FROM expenses
            WHERE trip_id = ?
            ORDER BY expense_date ASC, id ASC
        """, (trip_id,)).fetchall()

        return jsonify([dict(e) for e in expenses]), 200
    finally:
        conn.close()


@api.route("/api/trips/<int:trip_id>/expenses", methods=["POST"])
def add_expense(trip_id):
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    user_id = data.get("user_id") or get_request_user_id(data)
    if user_id is None:
        return jsonify({
            "error": "User ID is required"
        }), 400

    category = data.get("category")
    description = data.get("description") or data.get("title")
    amount = data.get("amount")
    expense_date = data.get("expense_date") or data.get("date")

    if not category:
        return jsonify({
            "error": "Expense category is required"
        }), 400

    if not description:
        return jsonify({
            "error": "Expense title or description is required"
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
        permission, error_response, status = require_editor_access(
            conn,
            trip_id,
            int(user_id)
        )

        if error_response:
            return error_response, status

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

        exp_id = cursor.lastrowid

        return jsonify({
            "message": "Expense added successfully",
            "expense": {
                "id": exp_id,
                "trip_id": trip_id,
                "category": category,
                "description": description,
                "title": description,
                "amount": amount,
                "expense_date": expense_date,
                "date": expense_date
            }
        }), 201
    finally:
        conn.close()


@api.route("/api/trips/<int:trip_id>/expenses/<int:expense_id>", methods=["PUT"])
@api.route("/api/expenses/<int:expense_id>", methods=["PUT"])
def update_expense(expense_id, trip_id=None):
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    user_id = data.get("user_id") or get_request_user_id(data)

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

        actual_trip_id = expense["trip_id"]
        permission, error_response, status = require_editor_access(
            conn,
            actual_trip_id,
            int(user_id)
        )

        if error_response:
            return error_response, status

        category = data.get("category")
        description = data.get("description") or data.get("title")
        amount = data.get("amount")
        expense_date = data.get("expense_date") or data.get("date")

        if amount is not None:
            try:
                amount = float(amount)
                if amount <= 0:
                    return jsonify({
                        "error": "Expense amount must be greater than 0"
                    }), 400
            except (TypeError, ValueError):
                return jsonify({
                    "error": "Amount must be a number"
                }), 400

        conn.execute("""
            UPDATE expenses
            SET category = COALESCE(?, category),
                description = COALESCE(?, description),
                amount = COALESCE(?, amount),
                expense_date = COALESCE(?, expense_date)
            WHERE id = ?
        """, (
            category,
            description,
            amount,
            expense_date,
            expense_id
        ))

        conn.commit()

        updated_expense = conn.execute("""
            SELECT
                id,
                trip_id,
                category,
                description,
                description AS title,
                amount,
                expense_date,
                expense_date AS date
            FROM expenses
            WHERE id = ?
        """, (expense_id,)).fetchone()

        return jsonify({
            "message": "Expense updated successfully",
            "expense": dict(updated_expense)
        }), 200
    finally:
        conn.close()


@api.route("/api/trips/<int:trip_id>/expenses/<int:expense_id>", methods=["DELETE"])
@api.route("/api/expenses/<int:expense_id>", methods=["DELETE"])
def delete_expense(expense_id, trip_id=None):
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id") or get_request_user_id(data)

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

        actual_trip_id = expense["trip_id"]
        permission, error_response, status = require_editor_access(
            conn,
            actual_trip_id,
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


@api.route("/api/trips/<int:trip_id>/budget", methods=["PUT"])
def update_budget(trip_id):
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    user_id = data.get("user_id") or get_request_user_id(data)
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
        """, (budget, trip_id))

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


# --------------------------------------------------
# TRIP SHARING (CRUD)
# --------------------------------------------------

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
            """, (trip_id, token))
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
@api.route("/api/shared/trips/<share_token>", methods=["GET"])
def get_shared_trip(share_token):
    conn = get_db_connection()
    try:
        trip = None
        share_record = conn.execute("""
            SELECT trip_id
            FROM trip_share_links
            WHERE share_token = ?
        """, (share_token,)).fetchone()

        if share_record:
            trip = conn.execute("""
                SELECT *
                FROM trips
                WHERE id = ?
            """, (share_record["trip_id"],)).fetchone()
        else:
            # Fallback if accessed via direct trip id
            try:
                trip_id_cand = int(share_token)
                trip = conn.execute("""
                    SELECT *
                    FROM trips
                    WHERE id = ?
                """, (trip_id_cand,)).fetchone()
            except (ValueError, TypeError):
                pass

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
            ORDER BY id ASC
        """, (trip_id,)).fetchall()

        itinerary = conn.execute("""
            SELECT
                itinerary.id,
                itinerary.trip_id,
                itinerary.destination_id,
                itinerary.activity,
                itinerary.activity_date,
                itinerary.activity_date AS date,
                itinerary.start_time,
                itinerary.start_time AS time,
                itinerary.end_time,
                itinerary.notes,
                COALESCE(destinations.name, destinations.city, '') AS location,
                destinations.name AS destination_name,
                destinations.latitude,
                destinations.longitude,
                destinations.latitude AS lat,
                destinations.longitude AS lng
            FROM itinerary
            LEFT JOIN destinations
                ON itinerary.destination_id = destinations.id
            WHERE itinerary.trip_id = ?
            ORDER BY
                itinerary.activity_date ASC,
                itinerary.start_time ASC,
                itinerary.id ASC
        """, (trip_id,)).fetchall()

        expenses = conn.execute("""
            SELECT
                id,
                trip_id,
                category,
                description,
                description AS title,
                amount,
                expense_date,
                expense_date AS date
            FROM expenses
            WHERE trip_id = ?
            ORDER BY expense_date ASC, id ASC
        """, (trip_id,)).fetchall()

        owner = conn.execute("""
            SELECT id, name, email
            FROM users
            WHERE id = ?
        """, (trip["user_id"],)).fetchone()

        collabs = conn.execute("""
            SELECT
                trip_collaborators.id,
                users.id AS user_id,
                users.name,
                users.email,
                trip_collaborators.role
            FROM trip_collaborators
            JOIN users
                ON trip_collaborators.user_id = users.id
            WHERE trip_collaborators.trip_id = ?
            ORDER BY users.name ASC
        """, (trip_id,)).fetchall()

        collaborator_list = []
        if owner:
            collaborator_list.append({
                "id": owner["id"],
                "user_id": owner["id"],
                "name": owner["name"],
                "email": owner["email"],
                "role": "Owner"
            })
        for c in collabs:
            collaborator_list.append({
                "id": c["id"],
                "user_id": c["user_id"],
                "name": c["name"],
                "email": c["email"],
                "role": c["role"].capitalize()
            })

        dest_list = [dict(d) for d in destinations]
        from_city = dest_list[0]["city"] or dest_list[0]["name"] if dest_list else ""
        to_city = dest_list[-1]["city"] or dest_list[-1]["name"] if dest_list else ""

        start_date = trip["start_date"] or ""
        end_date = trip["end_date"] or ""
        duration = "Flexible"
        if start_date and end_date:
            try:
                d1 = datetime.strptime(start_date, "%Y-%m-%d")
                d2 = datetime.strptime(end_date, "%Y-%m-%d")
                days = (d2 - d1).days + 1
                if days > 0:
                    duration = f"{days} {'day' if days == 1 else 'days'}"
            except Exception:
                pass

        start_lat = trip["start_latitude"] if "start_latitude" in trip.keys() else None
        start_lng = trip["start_longitude"] if "start_longitude" in trip.keys() else None
        dest_lat = trip["destination_latitude"] if "destination_latitude" in trip.keys() else None
        dest_lng = trip["destination_longitude"] if "destination_longitude" in trip.keys() else None

        # On-demand geocoding for shared trips created earlier or missing coordinates
        updated_db = False
        if from_city and (start_lat is None or start_lng is None):
            s_lat, s_lng = geocode_location(from_city)
            if s_lat is not None and s_lng is not None:
                start_lat, start_lng = s_lat, s_lng
                conn.execute("""
                    UPDATE trips
                    SET start_latitude = ?, start_longitude = ?
                    WHERE id = ?
                """, (start_lat, start_lng, trip_id))
                updated_db = True

        if to_city and (dest_lat is None or dest_lng is None):
            d_lat, d_lng = geocode_location(to_city)
            if d_lat is not None and d_lng is not None:
                dest_lat, dest_lng = d_lat, d_lng
                conn.execute("""
                    UPDATE trips
                    SET destination_latitude = ?, destination_longitude = ?
                    WHERE id = ?
                """, (dest_lat, dest_lng, trip_id))
                updated_db = True

        for d in dest_list:
            if d.get("latitude") is None or d.get("longitude") is None:
                city_name = d.get("city") or d.get("name")
                if city_name:
                    c_lat, c_lng = geocode_location(city_name)
                    if c_lat is not None and c_lng is not None:
                        d["latitude"] = c_lat
                        d["longitude"] = c_lng
                        conn.execute("""
                            UPDATE destinations
                            SET latitude = ?, longitude = ?
                            WHERE id = ?
                        """, (c_lat, c_lng, d["id"]))
                        updated_db = True

        if updated_db:
            conn.commit()

        trip_dict = {
            "id": trip["id"],
            "user_id": trip["user_id"],
            "name": trip["name"],
            "title": trip["name"],
            "destination": to_city or trip["name"],
            "fromCity": from_city,
            "toCity": to_city,
            "start_date": start_date,
            "startDate": start_date,
            "end_date": end_date,
            "endDate": end_date,
            "budget": float(trip["budget"] or 0),
            "duration": duration,
            "start_latitude": start_lat,
            "start_longitude": start_lng,
            "destination_latitude": dest_lat,
            "destination_longitude": dest_lng,
            "startLatitude": start_lat,
            "startLongitude": start_lng,
            "destinationLatitude": dest_lat,
            "destinationLongitude": dest_lng,
            "destinations": dest_list,
            "addedStops": dest_list,
            "itinerary": [dict(i) for i in itinerary],
            "expenses": [dict(e) for e in expenses],
            "collaborators": collaborator_list,
            "currentUserRole": "Viewer",
            "shareToken": share_token
        }

        trip_dict["trip"] = dict(trip)
        return jsonify(trip_dict), 200
    finally:
        conn.close()


# --------------------------------------------------
# COLLABORATORS (CRUD)
# --------------------------------------------------

@api.route("/api/trips/<int:trip_id>/collaborators", methods=["GET"])
def get_collaborators(trip_id):
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

        owner = conn.execute("""
            SELECT id, name, email
            FROM users
            WHERE id = ?
        """, (trip["user_id"],)).fetchone()

        collaborators = conn.execute("""
            SELECT
                trip_collaborators.id,
                users.id AS user_id,
                users.name,
                users.email,
                trip_collaborators.role
            FROM trip_collaborators
            JOIN users
                ON trip_collaborators.user_id = users.id
            WHERE trip_collaborators.trip_id = ?
            ORDER BY users.name ASC
        """, (trip_id,)).fetchall()

        result = []
        if owner:
            result.append({
                "id": owner["id"],
                "user_id": owner["id"],
                "name": owner["name"],
                "email": owner["email"],
                "role": "owner"
            })

        for collaborator in collaborators:
            result.append({
                "id": collaborator["id"],
                "user_id": collaborator["user_id"],
                "name": collaborator["name"],
                "email": collaborator["email"],
                "role": collaborator["role"]
            })

        return jsonify({
            "collaborators": result
        }), 200
    finally:
        conn.close()


@api.route("/api/trips/<int:trip_id>/collaborators", methods=["POST"])
@api.route("/api/trips/<int:trip_id>/collaborators/invite", methods=["POST"])
def add_collaborator(trip_id):
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    user_id = data.get("user_id") or get_request_user_id(data)
    email = data.get("email")
    role = (data.get("role") or "viewer").strip().lower()

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

        if user_id:
            permission, error_response, status = require_owner_access(
                conn,
                trip_id,
                int(user_id)
            )
            if error_response:
                return error_response, status

        target_user = conn.execute("""
            SELECT id, name, email
            FROM users
            WHERE LOWER(email) = ?
        """, (email,)).fetchone()

        if not target_user:
            return jsonify({
                "error": "User with this email does not exist"
            }), 404

        if target_user["id"] == trip["user_id"]:
            return jsonify({
                "error": "Trip owner is already the owner"
            }), 400

        existing = conn.execute("""
            SELECT id
            FROM trip_collaborators
            WHERE trip_id = ?
            AND user_id = ?
        """, (trip_id, target_user["id"])).fetchone()

        if existing:
            return jsonify({
                "error": "User is already a collaborator"
            }), 409

        cursor = conn.execute("""
            INSERT INTO trip_collaborators (
                trip_id,
                user_id,
                role
            )
            VALUES (?, ?, ?)
        """, (
            trip_id,
            target_user["id"],
            role
        ))

        conn.commit()

        return jsonify({
            "message": "Collaborator added successfully",
            "collaborator": {
                "id": cursor.lastrowid,
                "user_id": target_user["id"],
                "name": target_user["name"],
                "email": target_user["email"],
                "role": role
            }
        }), 201
    finally:
        conn.close()


@api.route("/api/trips/<int:trip_id>/collaborators/<int:target_id>", methods=["PUT"])
def update_collaborator_role(trip_id, target_id):
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    user_id = data.get("user_id") or get_request_user_id(data)
    role = (data.get("role") or "").strip().lower()

    if role not in ["viewer", "editor"]:
        return jsonify({
            "error": "Role must be viewer or editor"
        }), 400

    conn = get_db_connection()
    try:
        if user_id:
            permission, error_response, status = require_owner_access(
                conn,
                trip_id,
                int(user_id)
            )
            if error_response:
                return error_response, status

        collaborator = conn.execute("""
            SELECT id, user_id
            FROM trip_collaborators
            WHERE trip_id = ?
            AND (id = ? OR user_id = ?)
        """, (trip_id, target_id, target_id)).fetchone()

        if not collaborator:
            return jsonify({
                "error": "Collaborator not found"
            }), 404

        conn.execute("""
            UPDATE trip_collaborators
            SET role = ?
            WHERE id = ?
        """, (role, collaborator["id"]))

        conn.commit()

        return jsonify({
            "message": "Collaborator role updated successfully",
            "user_id": collaborator["user_id"],
            "role": role
        }), 200
    finally:
        conn.close()


@api.route("/api/trips/<int:trip_id>/collaborators/<int:target_id>", methods=["DELETE"])
def remove_collaborator(trip_id, target_id):
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id") or get_request_user_id(data)

    conn = get_db_connection()
    try:
        if user_id:
            permission, error_response, status = require_owner_access(
                conn,
                trip_id,
                int(user_id)
            )
            if error_response:
                return error_response, status

        collaborator = conn.execute("""
            SELECT id, user_id
            FROM trip_collaborators
            WHERE trip_id = ?
            AND (id = ? OR user_id = ?)
        """, (trip_id, target_id, target_id)).fetchone()

        if not collaborator:
            return jsonify({
                "error": "Collaborator not found"
            }), 404

        conn.execute("""
            DELETE FROM trip_collaborators
            WHERE id = ?
        """, (collaborator["id"],))

        conn.commit()

        return jsonify({
            "message": "Collaborator removed successfully"
        }), 200
    finally:
        conn.close()
