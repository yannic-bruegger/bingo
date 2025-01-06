from cell import Cell

class Card:

    def __init__(self, cells, cardId, size):
        self.cells = cells
        self.cardId = cardId
        self.size = size

    def hashCard(self):
        self.cardId = hash(self)
