
import os
import pyodbc
from dotenv import load_dotenv

load_dotenv()

server = os.getenv("DB_SERVER")
database = os.getenv("DB_NAME")
driver = os.getenv("DB_DRIVER")

connection_string = (
    f"DRIVER={{{driver}}};"
    f"SERVER={server};"
    f"DATABASE={database};"
    "Trusted_Connection=yes;"
    "Encrypt=yes;"
    "TrustServerCertificate=yes;"
)

try:
    with pyodbc.connect(connection_string, timeout=10) as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT DB_NAME()")
        print("Database connected successfully!")
        print("Connected database:", cursor.fetchone()[0])
except pyodbc.Error as error:
    print("Database connection failed:")
    print(error)
