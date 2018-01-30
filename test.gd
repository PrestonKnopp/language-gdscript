extends Node

if,for,elif,else,var,onready,export,breakpoint,break,continue,pass,return,class,extends,is,tool,self,yield
func,static,const,match,enum,setget,

signal hello_world
signal with_params(one=1, two="hello")

const CONST_VAR = "Blah blah blah"

enum Hello {
	ONE, TWO = 5
}

enum {
	ANON_ONE = 100,
	ANON_TWO
}

class InnerClass extends Blah:
	var in_member = "Blah Blah"
	func test():
		pass

var avar = 100 setget onefunc,twofunc
var bvar = 500 setget ,twofunc
var cvar = 200 setget onefunc
func onefunc(s="hello"):
	avar = s
func twofunc():
	return avar

onready var dict = {
	hello = "world",
	"hello" : 1,
	22 : Vector2("Hello")
}

var member = 100
export(Vector2) var exported_member = Vector2(0.1, 0.335)

func hello(to="world"):
	print("Hello, ", to, "!")
	print("Format %s" % "Specifier")

static func hello():
	pass

func loops():
	for x in [5, 7, 11]:
	    statement  # loop iterates 3 times with x as 5, then 7 and finally 11

	var dict = {"a":0, "b":1, "c":2}
	for i in dict:
	    print(dict[i])  # loop provides the keys in an arbitrary order; may print 0, 1, 2, or 2, 0, 1, etc...

	for i in range(3):
	    statement  # similar to [0, 1, 2] but does not allocate an array

	for i in range(1,3):
	    statement  # similar to [1, 2] but does not allocate an array

	for i in range(2,8,2):
	    statement  # similar to [2, 4, 6] but does not allocate an array

	for c in "Hello":
	    print(c)

master func mf():
	print("Master")

slave func sf():
	print("Slave")

sync func syf():
	print("Sync")

func do_some_match(v):
	match v:
		1,2,3,"sword":
			print("indents correctly")
		"hello": print("v is hello")
		Hello.ONE: print("v is one")
		[var b, _, "hello"]: print("v is arr")
		{"name" : "dennis", "age" : var age}: print("get age")
		1: print("v is 1")
		var bind_v: print("bound v", bind_v)
		_: print("v is anything")
