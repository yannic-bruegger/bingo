# bingo

## Documentation

### GameState

Actions are marked as A

Events are marked as E

#### State: ``NONE``

A/E | Name | Next State
--- | ---- | ----------
A   | ``createNewGame`` |  |
A   | ``joinGame`` |  |
E   | ``session_created`` | [JOINED](#state-joined) |
E   | ``session_joined`` | [JOINED](#state-joined) |

#### State: ``JOINED``

A/E | Name | Next State
--- | ---- | ----------
A   | ``startGame`` |  |
E   | ``player_joined`` |  |
E   | ``player_left`` |  |
E   | ``game_started`` | [STARTED](#state-started) |

#### State: ``STARTED``

A/E | Name | Next State
--- | ---- | ----------
A   | ``stampCell`` |  |
A   | ``unstampCell`` |  |
A   | ``stopGame`` |  |
E   | ``game_stopped`` |  |
E   | ``player_joined`` |  |
E   | ``player_left`` |  |
E   | ``player_stamped_cell`` |  |
E   | ``player_unstamped_cell`` |  |
E   | ``player_has_bingo`` |  |
E   | ``player_received_card`` |  |