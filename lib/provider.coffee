{readFileSync} = require 'fs'
path = require 'path'

module.exports =
    provider =
        completions: null
        globalCompletions: null
        constantCompletions: null
        selector: '.source.gdscript'
        disableForSelector: '.punctuation.definition.comment.gdscript, .string.quoted.single.gdscript, .string.quoted.double.gdscript, .variable.parameter.gdscript, .variable.other.gdscript, .variable.parameter.function.gdscript, .punctuation.definition.parameters.comma.gdscript, .punctuation.definition.parameters.space.gdscript, .punctuation.definition.parameters.begin.bracket.round.gdscript, .punctuation.definition.parameters.end.bracket.round.gdscript'

        inclusionPriority: 1
        enabled: true
#        excludeLowerPriority: true

        loadCompletions: ->
            allCompletions = JSON.parse readFileSync(path.resolve(__dirname, '..', 'snippets', 'gdscript-completions.json'))
            @globalCompletions = allCompletions.globals
            @completions = allCompletions.completions
            @constantCompletions = allCompletions.constants

        clearCompletions: ->
            @globalCompletions = null
            @completions = null
            @constantCompletions = null

        getSuggestions: ({editor, bufferPosition, scopeDescriptor, prefix}) ->
            if atom.config.get('lang-gdscript.disableBasicCompletions')
                @enabled = false
                @clearCompletions()
                return null
            else if not @enabled
                @enabled = true
                @loadCompletions()

            self = this
            new Promise (resolve) ->
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

                resolve(completions)
