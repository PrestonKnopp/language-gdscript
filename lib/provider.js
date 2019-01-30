let provider;
const {readFileSync} = require('fs');
const path = require('path');

module.exports =
	(provider = {
		completions: null,
		globalCompletions: null,
		constantCompletions: null,
		selector: '.source.gdscript',
		disableForSelector: '.punctuation.definition.comment.gdscript, .string.quoted.single.gdscript, .string.quoted.double.gdscript, .variable.parameter.gdscript, .variable.other.gdscript, .variable.parameter.function.gdscript, .punctuation.definition.parameters.comma.gdscript, .punctuation.definition.parameters.space.gdscript, .punctuation.definition.parameters.begin.bracket.round.gdscript, .punctuation.definition.parameters.end.bracket.round.gdscript',

		inclusionPriority: 1,
		enabled: false,

		loadCompletions() {
			const allCompletions = require('../snippets/gdscript-completions.json');
			this.globalCompletions = allCompletions.globals;
			this.completions = allCompletions.completions;
			this.constantCompletions = allCompletions.constants;
		},

		clearCompletions() {
			this.globalCompletions = null;
			this.completions = null;
			this.constantCompletions = null;
		},

		getSuggestions({editor, bufferPosition, scopeDescriptor, prefix}) {
			if (atom.config.get('lang-gdscript.disableBasicCompletions')) {
				this.enabled = false;
				this.clearCompletions();
				return null;
			} else if (!this.enabled) {
				this.enabled = true;
				this.loadCompletions();
			}

			const self = this;
			return new Promise(function(resolve) {
				let co;
				const completions = [];
				const len = prefix.length;
				const ch = prefix[0];

				const gc = self.globalCompletions[ch];
				const cc = self.constantCompletions[ch];
				const c = self.completions[ch];

				if (gc !== undefined) {
						for (co of gc) {
							if (co.displayText.startsWith(prefix)) {
									co.replacementPrefix = prefix;
									completions.push(co);
								}
						}
					}
				if (cc !== undefined) {
						for (co of cc) {
							if (co.displayText.startsWith(prefix)) {
									co.replacementPrefix = prefix;
									completions.push(co);
								}
						}
					}
				if (c !== undefined) {
						for (co of c) {
							if (co.displayText.startsWith(prefix)) {
									co.replacementPrefix = prefix;
									completions.push(co);
								}
						}
					}

				resolve(completions);
			});
		}
	});
