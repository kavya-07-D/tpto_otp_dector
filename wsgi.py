"""
WSGI Entry Point for Production Deployment (Render, Gunicorn, Heroku)
"""
from backend.main import app

if __name__ == "__main__":
    app.run()
