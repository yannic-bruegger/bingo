print('Bingo')

from wordList import WordList
from word import Word
from pprint import pprint



thKoeln = WordList([
    Word("Vorlesung", 1), Word("Seminar", 2), Word("Professor", 3),
    Word("Studierende", 4), Word("Campus", 5), Word("Bibliothek", 6),
    Word("Prüfung", 7), Word("Abschlussarbeit", 8), Word("Dozent", 9),
    Word("Mensa", 10), Word("Hörsaal", 11), Word("Studiengang", 12),
    Word("Bachelor", 13), Word("Master", 14), Word("Promotion", 15),
    Word("Forschung", 16), Word("Klausur", 17), Word("Tutorium", 18),
    Word("Einschreibung", 19), Word("Modul", 20), Word("Kreditpunkte", 21),
    Word("Skripte", 22), Word("Labor", 23), Word("Semester", 24),
    Word("Exkursion", 25), Word("Fachschaft", 26), Word("Immatrikulation", 27),
    Word("Hochschulrat", 28), Word("Stipendium", 29), Word("Lehrstuhl", 30)
], "thKoeln")

card1 = thKoeln.generateCard()

print(len(card1.cells))
for x in card1.cells:
    pprint(vars(x))
    pprint(vars(x.word))
