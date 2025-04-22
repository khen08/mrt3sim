from src.api import app # Import the app instance from your api module

if __name__ == '__main__':
    print("Starting Flask development server...")
    # Configuration for host and port might also be loaded from env variables here
    app.run(debug=True, host='0.0.0.0', port=5001)
