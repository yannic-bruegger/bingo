from word import Word
from card import Card
from cell import Cell
from deck import Deck
import random

class WordList:
    def __init__(self, words, topic):
        self.words = words
        self.topic = topic

    def add(self, word):
        self.words.append(word)

    def getRandomWord(self):
        return random.choice(self.words)

    def generateCard(self):
        seen = set()
        cellArray = []
        while len(cellArray) < 24:
            currentWord = self.getRandomWord()
            if currentWord not in seen:
                cellArray.append(Cell(False, currentWord))
                seen.add(currentWord)

        return Card(cellArray, 1, 5)

    def generateDeck(self, size):
        cards = []
        tempCounter = 0

        while tempCounter < size:
            cards.append(self.generateCard())
            tempCounter += 1

        tempCounter = 0
        return Deck(cards, size)
