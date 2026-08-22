from flask import Flask
from flask_cors import CORS

from database import init_db
from routes import api


app = Flask(__name__)

CORS(app)

init_db()

app.register_blueprint(api)


if __name__ == "__main__":
    app.run(debug=True)