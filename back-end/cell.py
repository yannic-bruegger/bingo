class Cell:
    def __init__(self, stamped, word):
        self.stamped = stamped
        self.word = word

    def stamp(self, stamped):
        self.stamped = True

    def unstamp(self, stamped):
        self.stamped = False

