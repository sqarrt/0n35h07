class_name RoomCode
## Room-code-like strings — port of web net/roomCode randomRoomCode: four base-36 upper-case characters (the shared
## music seed of a match).

const ALPHABET := "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"   # web: base-36, upper case
const LENGTH := 4                                           # web CODE_LEN

static func random(rng: Callable) -> String:
	var code := ""
	for i in LENGTH:
		code += ALPHABET[mini(ALPHABET.length() - 1, floori(rng.call() * ALPHABET.length()))]
	return code
