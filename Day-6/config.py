import os
from dotenv import load_dotenv

# Load environment variables from .env (if present)
load_dotenv()

# Database Config
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "vehicle_sales_db")

CSV_FILE_PATH = os.path.join(os.path.dirname(__file__), "car_prices.csv")
MAX_ROWS = 1500
