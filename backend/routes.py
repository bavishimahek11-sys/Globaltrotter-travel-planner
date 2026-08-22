from flask import Blueprint, jsonify

api = Blueprint("api", __name__)


@api.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "success",
        "message": "GlobalTrotter backend is running"
    })