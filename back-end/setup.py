import json
import jsonpickle
import random
from json import JSONEncoder

print('Bingo')
import asyncio
import websockets

from wordList import WordList
from word import Word
from pprint import pprint
from session import Session
from player import Player
from game import Game

#--------------------------------------------------

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
#Beispielkarte wird erstellt
#card1 = thKoeln.generateCard()
#card1.hashCard()
#Beispielkarte wird geprintet
#print(len(card1.cells))
#for x in card1.cells:
    #pprint(vars(x))
 #   pprint(vars(x.word))
#pprint(card1.cardId)

#--------------------------------------------------

#Beispieldeck wird erstellt und geprintet
#deck1 = thKoeln.generateDeck(5)
#print(type(deck1.cards))
#print(len(deck1.cards))
#for card in deck1.cards:
 #   for x in card.cells:
        # pprint(vars(x))
 #       pprint(vars(x.word))
 #   print("--------------------------------------")

#--------------------------------------------------

SESSIONS = set()

def getPlayerSockets(players):
    sockets = set()
    for player in players:
        sockets.add(player.websocket)
    return sockets

async def echo(websocket):
  async for message in websocket:
    messageJson = json.loads(message)


    if "createsession" in messageJson: # Neue Session erstellen und Spieler hinzufügen
        newSession = Session()
        newSession.addplayer(Player(messageJson["name"], websocket))
        SESSIONS.add(newSession)
        await websocket.send(json.dumps({ "sessionId": newSession.id }))
        await websocket.send(json.dumps({"type": "joined_successfully", "players": messageJson["name"]}))
    else: # Check ob Session existiert und dann Nachricht in die Session senden
        session = next((x for x in SESSIONS if x.id == messageJson["session"]), None)
        if session != None: # Wenn Session existiert

            sessionCardList = list()
            sessionPlayerList = list()

            if "event" in messageJson:
                event = messageJson["event"]
                if event == "join" and "name" in messageJson:
                    player = next((y for y in session.players if y == websocket), None) # finde spieler in session
                    if player == None: # Ist spieler noch nicht in der session füge ihn hinzu
                        session.players.add(Player(messageJson["name"], websocket))
                    await websocket.send(json.dumps({"type": "success", "message": "successfully joined"}))
                    temp_players_list = list()
                    for i in session.players:
                        temp_players_list.append(i.name)
                    print(temp_players_list)
                    #sampleJson = jsonpickle.encode(session.players)
                    #print(sampleJson["name"])
                    #await websocket.send(json.dumps({"type": "joined_successfully", "players": json.dumps(temp_players_list) }))
                    await websocket.send(json.dumps({"type": "joined_successfully", "players": temp_players_list}))
                    #websockets.broadcast(getPlayerSockets(session.players), "user joined")
                    #websockets.broadcast(getPlayerSockets(session.players), json.dumps({"players": temp_players_list}))
                    websockets.broadcast(getPlayerSockets(session.players), json.dumps({"type": "user_joined", "name": messageJson["name"]}))

                elif event == "leave":
                    websockets.broadcast(session.players, "user left")

                elif event == "startGame":
                    deck = thKoeln.generateDeck(int(messageJson["decksize"]))

                    #troubleshooting
                    cardarray = []
                    playerarray = []
                    playerandcardarray = []

                    #for card in deck.cards:
                     #   for x in card.cells:
                      #      pprint(vars(x.word))
                     #   print("--------------------------------------")

                    game = Game(session, deck)

                    for player in session.players:
                        sessionCardList.append(random.choice(deck.cards))
                        sessionPlayerList.append(player)

                    tempplayercard = {}

                    #print(sessionCardList)
                    for x in sessionCardList:
                        cardarray.append(x.cardId)

                    for x in sessionPlayerList:
                        playerarray.append(x.name)

                    for x, cardId in enumerate(cardarray):
                        tempplayercard[playerarray[x]] = cardId

                    print(len(cardarray))
                    print("Player")
                    print(tempplayercard)

                    json_string = json.dumps({"cards": cardarray, "players": playerarray})
                    print(json_string)





                    with open('file.json', 'w') as f:
                       json.dump([{'card': cardid, 'player': name} for cardid, name in zip(cardarray, playerarray)], f)
                    websockets.broadcast(getPlayerSockets(session.players), json_string)

                    # Deck bauen, karten für alle spieler ziehen und als set / array / object / collection an alle player senden -> vorher in der db sichern
                    #websockets.broadcast(session.players, message) # Sende die Nachricht des spielers an alle session spieler

            elif "action" in messageJson:
                action = messageJson["action"]
                if action == "stamp":
                    websockets.broadcast(session.players, "stamp")

        else: # Wenn Session nicht existiert
            await websocket.send("No such session.")

#--------------------------------------------------

async def main():
    async with websockets.serve(echo, "0.0.0.0", 8765):
        await asyncio.Future()  # run forever

asyncio.run(main())
