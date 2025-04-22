from prisma import Prisma

print("Initializing DB client in database/connect.py...")
db = Prisma()
try:
    db.connect()
    print("Database client connected.")
except Exception as e:
    print(f"Error connecting database client: {e}") 