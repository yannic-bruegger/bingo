import random

class Session:
    def __init__(self):
        self.id = str(random.randint(100000, 999999))
        self.players = set()


    #def addPlayer(self, websocket):
     #   self.players.add(websocket)
    def addplayer(self, player):
        self.players.add(player)