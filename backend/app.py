from flask import Flask
from flask_cors import CORS

def create_app():
    # --- Initialize Flask App --- 
    app = Flask(__name__)
    CORS(app) # Enable CORS for all routes
    print("API initialized") # Adjust print statement

    # --- Import and Register Blueprints ---
    from routes import main_bp # Import the blueprint
    app.register_blueprint(main_bp) # Register it
    print("Registered main blueprint")

    return app

if __name__ == '__main__':
    app = create_app() # Create the app instance using the factory
    print("Starting Flask development server...")
    # Configuration for host and port might also be loaded from env variables here
    app.run(debug=True, host='0.0.0.0', port=5001)
