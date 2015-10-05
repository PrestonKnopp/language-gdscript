{readFileSync} = require 'fs'
path = require 'path'

module.exports =
    provider =
        completions: null
        globalCompletions: null
        constantCompletions: null
        selector: '.source.gdscript'
        disableForSelector: '.punctuation.definition.comment.gdscript, .string.quoted.single.gdscript, .string.quoted.double.gdscript'

        inclusionPriority: 2
        excludeLowerPriority: true

        loadCompletions: ->
            allCompletions = JSON.parse readFileSync(path.resolve(__dirname, '..', 'snippets', 'gdscript-completions.json'))
            @globalCompletions = allCompletions.globals
            @completions = allCompletions.completions
            @constantCompletions = allCompletions.constants

        getSuggestions: ({editor, bufferPosition, scopeDescriptor, prefix}) ->
            self = this
            new Promise (resolve) ->
                # console.time('a')

                completions = []
                len = prefix.length
                ch = prefix[0]

                gc = self.globalCompletions[ch]
                cc = self.constantCompletions[ch]
                c = self.completions[ch]

                if gc isnt undefined
                    for co in gc
                        if co.displayText.startsWith(prefix)
                            co.replacementPrefix = prefix
                            completions.push co
                if cc isnt undefined
                    for co in cc
                        if co.displayText.startsWith(prefix)
                            co.replacementPrefix = prefix
                            completions.push co
                if c isnt undefined
                    for co in c
                        if co.displayText.startsWith(prefix)
                            co.replacementPrefix = prefix
                            completions.push co

                # console.timeEnd 'a'
                resolve(completions)
