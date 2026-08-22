import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_PATH = os.path.join(BASE_DIR, "globaltrotter.db")


def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db_connection()

    # Users table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Trips table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS trips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            start_date TEXT,
            end_date TEXT,
            budget REAL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE
        )
    """)

    # Destinations table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS destinations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trip_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            city TEXT,
            country TEXT,
            visit_date TEXT,
            notes TEXT,
            FOREIGN KEY (trip_id) REFERENCES trips(id)
            ON DELETE CASCADE
        )
    """)
    # Add location columns to existing destinations table
    destination_columns = conn.execute(
            "PRAGMA table_info(destinations)"
        ).fetchall()

    column_names = [column["name"] for column in destination_columns]

    if "latitude" not in column_names:
            conn.execute("""
                ALTER TABLE destinations
                ADD COLUMN latitude REAL
            """)

    if "longitude" not in column_names:
            conn.execute("""
                ALTER TABLE destinations
                ADD COLUMN longitude REAL
            """)

    # Itinerary table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS itinerary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trip_id INTEGER NOT NULL,
            destination_id INTEGER,
            activity TEXT NOT NULL,
            activity_date TEXT,
            start_time TEXT,
            end_time TEXT,
            notes TEXT,
            FOREIGN KEY (trip_id) REFERENCES trips(id)
            ON DELETE CASCADE,
            FOREIGN KEY (destination_id) REFERENCES destinations(id)
            ON DELETE SET NULL
        )
    """)

    # Expenses table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trip_id INTEGER NOT NULL,
            category TEXT NOT NULL,
            description TEXT,
            amount REAL NOT NULL,
            expense_date TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (trip_id) REFERENCES trips(id)
            ON DELETE CASCADE
        )
    """)

    conn.commit()
    conn.close()