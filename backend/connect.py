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
    
    # Mark as initialized
    sys.modules[__name__]._prisma_initialized = True
    
    if log_level != 'QUIET':
        print("[PRISMA] PRISMA CLIENT INITIALIZED AND READY FOR CONNECTIONS")
elif log_level == 'DEBUG':
    print("\n[PRISMA] REUSING EXISTING PRISMA CLIENT FROM connect.py") # Subsequent imports