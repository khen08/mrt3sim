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
        print("\n[Prisma] Initializing Prisma Client in connect.py") # First time import
    
    # Mark as initialized
    sys.modules[__name__]._prisma_initialized = True
    
    if log_level != 'QUIET':
        print("[Prisma] Prisma Client initialized and ready for connections")
elif log_level == 'DEBUG':
    print("\n[Prisma] Reusing existing Prisma Client from connect.py") # Subsequent imports