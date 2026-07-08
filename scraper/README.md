# LeetPix scraper

Python service that produces fantasy **projections** and **actual stat lines**
for players, consumed by the Node API.

> **Open decision:** the projection source (free API, a library, or scraping
> ESPN/Yahoo/Sleeper) is not yet chosen. `src/projections.py` defines the seam —
> implement `get_projections` there once we pick one, keeping the return shape.

## Dev

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python src/projections.py
```

## How it fits

1. On poll creation, the API requests projections for the referenced players.
2. The API applies the poll's scoring format (`server/src/services/scoring.ts`)
   to the raw stats → projected points shown on each option.
3. After games finish, actual stat lines resolve the poll and grade votes.
