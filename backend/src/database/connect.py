from prisma import Prisma

print("Initializing DB client in database/connect.py...")
db = Prisma()
try:
    db.connect()
    print("Database client connected successfully.")
except Exception as e:
    print(f"Error connecting database client in connect.py: {e}")
    # Depending on requirements, you might want to raise the exception
    # or handle it in a way that prevents the app from starting broken. 