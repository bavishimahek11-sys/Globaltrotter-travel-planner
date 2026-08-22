from flask import Flask, send_from_directory
from flask_cors import CORS
import os

from database import init_db
from routes import api

app = Flask(__name__)

CORS(app)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_FOLDER = os.path.join(BASE_DIR, "frontend")


init_db()

app.register_blueprint(api)

# Serve index.html
@app.route("/")
def index():
    return send_from_directory(FRONTEND_FOLDER, "index.html")


# Serve all frontend files
@app.route("/<path:path>")
def frontend_files(path):
    if path.startswith("api/"):
        return {"error": "API endpoint not found"}, 404

    file_path = os.path.join(FRONTEND_FOLDER, path)

    if os.path.isfile(file_path):
        return send_from_directory(FRONTEND_FOLDER, path)

    return send_from_directory(FRONTEND_FOLDER, "index.html")


if __name__ == "__main__":
    app.run(debug=True)