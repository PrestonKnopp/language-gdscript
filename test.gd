tool
extends Class.SubClass
extends "path/path".Class
class_name SomeClassName, "icon_path"

signal hello_world
signal with_params(one, two)

const CONST_VAR = "Blah blah blah"
const OTHER_CONST := "Hello"
const LAST_CONST: Node = Node.new()

enum Hello {
	ONE, TWO = 5,
	One_1 = 1,
	TWO_2 = 2
}

enum {
	ANON_ONE = 100,
	ANON_TWO
}

class InnerClass extends "World".Hello.World:
	var in_member = "Blah Blah"
	func test():
		pass

var butt: Hello = "hello"
var butt := "hello" setget set,get
var avar = 100 setget onefunc,twofunc
var bvar = 500 setget ,twofunc
var cvar = 200 setget onefunc
func onefunc(s="hello"):
	""" Test Comment String """
	"""
	Another Comment String
	Right Here
	"""
	avar = s
func twofunc():
	return avar

func typed(arg: Hello = Hello.WORLD) -> Hello:
	return arg.hello.world().what[1].okay()

onready var dict = {
	"""
	This comment string should be invalid.
	"""
	hello = "world",
	"hello" : 1,
	22 : Vector2("Hello")
}

var member = 100
export(Vector2) var exported_member = Vector2(0.1, 0.335)

func hello(to="world"):
	print("Hello, ", to, "!")
	print("Format %s" % "Specifier")
	return hello as World2D

static func hello():
	pass

func loops() -> Hello:
	if hello and whatsup:
		print('hello and whatsup')
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

remote func rf():
	print("Remote")

puppetsync func sf():
	print("Slave")

puppet func syf():
	print("Sync")

func escapes_in_str():
	test = " \n hello \n \b\b\b\n \\ \'\\\"\? \?"
	hello = 'hello \n okay that\'s okay. \\\\ \b \n \\\b\a\?'

func do_some_match(v):
	match v:
		1,2,3,"sword":
			print("indents correctly")
		"hello": print("v is hello")
		Hello.ONE: print("v is one")
		[var b, _, "hello"]: print("v is arr")
		{"name" : "dennis", "age" : var age}: print("get age")
		{"hello": "world", ..}: print("open ending dict")
		1: print("v is 1")
		var bind_v: print("bound v", bind_v)
		_: print("v is anything")
