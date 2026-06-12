from app.database import engine
from sqlalchemy import text

def main():
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE matches ADD updated_at DATETIME NULL;"))
            print("Column updated_at added successfully.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
