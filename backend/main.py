"""Development entry point, matching the requested standard project layout."""

import uvicorn

if __name__ == "__main__":
    uvicorn.run("poker.api:app", host="0.0.0.0", port=8000)
