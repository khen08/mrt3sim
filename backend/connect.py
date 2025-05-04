import os
import sys
from prisma import Prisma

# Check for environment variable to control log verbosity
log_level = os.environ.get('MRT3SIM_LOG_LEVEL', 'INFO').upper()

# Initialize the Prisma client
db = Prisma()

# Mark this module as initialized if not done already
if not hasattr(sys.modules[__name__], '_prisma_initialized'):
    if log_level != 'QUIET':
        print("\n[PRISMA] INITIALIZING PRISMA CLIENT IN connect.py") # First time import
    
    # Mark as initialized *before* attempting connect
    sys.modules[__name__]._prisma_initialized = True
    
    try:
        # Attempt to connect the client when it's first initialized
        db.connect()
        if log_level != 'QUIET':
            print("[PRISMA] PRISMA CLIENT CONNECTED AND POOL READY")
    except Exception as e:
        # Log critical error if connection fails on startup
        print(f"[PRISMA] CRITICAL: FAILED TO CONNECT PRISMA CLIENT ON INITIALIZATION: {e}", file=sys.stderr)
        # Depending on app structure, might want to exit or raise here
        # For now, just print the error. The app might fail later when trying to query.

elif log_level == 'DEBUG':
    print("\n[PRISMA] REUSING EXISTING PRISMA CLIENT FROM connect.py") # Subsequent imports