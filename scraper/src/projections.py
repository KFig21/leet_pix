"""Fantasy projection source.

This module is the single seam for *where* projections come from. The decision
(free API vs. library vs. scraping ESPN/Yahoo/Sleeper) is deferred — implement
`get_projections` against whichever source we pick, keeping the return shape
stable so the Node API/scoring layer doesn't care about the source.
"""

from dataclasses import dataclass
from typing import Literal

Sport = Literal["FOOTBALL", "BASEBALL"]


@dataclass
class PlayerProjection:
    player_id: str
    player_name: str
    sport: Sport
    # Raw stat line keyed by category (passingYards, reception, homeRun, ...).
    # The Node scoring layer applies the poll's scoring format to these.
    stats: dict[str, float]


def get_projections(sport: Sport, player_ids: list[str]) -> list[PlayerProjection]:
    """Return raw projected stat lines for the given players.

    TODO: implement against the chosen source. Stubbed for now.
    """
    raise NotImplementedError("Wire up a projections source (API/library/scrape)")


if __name__ == "__main__":
    print("Scraper entrypoint — implement get_projections().")
