module.exports = {

	normalizeQuotes(str) {
		return (str || '').replace('"', '\'')
	},

	last(fromArray) {
		return fromArray[fromArray.length - 1]
	},

	DoubleLinkedList: class DoubleLinkedList {
		constructor() {
			this.head = null
			this.tail = null
		}

		append(item) {
			if (this.head === null)
				this.head = this.tail = item
			else {
				this.tail.next = item
				item.prev = this.tail
				this.tail = item
			}
		}

		prepend(item) {
			if (this.head === null)
				this.head = this.tail = item
			else {
				this.head.prev = item
				item.next = this.head
				this.head = item
			}
		}

		insert(item, afterItem) {
			if (afterItem.next)
				item.next = afterItem.next
			item.prev = afterItem
		}

		remove(item) {
			if (item.prev)
				item.prev.next = item.next
			if (item.next)
				item.next.prev = item.prev
		}
	},

	LinkedListItem: class LinkedListItem {
		constructor() {
			this.prev = null
			this.next = null
			this.data = null
		}
	}

}
