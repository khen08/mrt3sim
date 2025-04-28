from flask import Flask
from flask_cors import CORS
# --- Initialize Flask App ---
app = Flask(__name__)
CORS(app) # Enable CORS for all routes
print("API initialized") # Adjust print statement

# --- Import Routes ---
import routes

if __name__ == '__main__':
    print("Starting Flask development server...")
    # Configuration for host and port might also be loaded from env variables here
    app.run(debug=True, host='0.0.0.0', port=5001)
