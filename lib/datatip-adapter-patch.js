/* Godot LS sends an empty range in datatip response
 * and Atom's datatip service will only work with a valid range.
 *
 * Let's just patch DatatipAdapter for now.
 */
const { Convert } = require('atom-languageclient')

module.exports = function patch(datatipAdapter) {

	datatipAdapter.getDatatip = function(connection, editor, point) {
		const documentPositionParams = Convert.editorToTextDocumentPositionParams(editor, point)

		return connection.hover(documentPositionParams).then((hover) => {
			if (hover == null || this.constructor.isEmptyHover(hover)) {
				return null;
			}

			const range = getWordAtPosition(editor, point)
			const markedStrings = (Array.isArray(hover.contents) ? hover.contents : [hover.contents]).map((str) =>
				this.constructor.convertMarkedString(editor, str),
			);

			return { range, markedStrings };
		})

	}

}

/** Begin methods from atom-languageclient/utils **/
function getWordAtPosition(editor, position) {
	const nonWordCharacters = escapeRegExp(editor.getNonWordCharacters(position));
	const range = _getRegexpRangeAtPosition(editor.getBuffer(), position, new RegExp(`^[\t ]*$|[^\\s${nonWordCharacters}]+`, 'g'));
	if (range == null) {
		return new atom_1.Range(position, position);
	}
	return range;
}
function escapeRegExp(string) {
	// From atom/underscore-plus.
	return string.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}
function _getRegexpRangeAtPosition(buffer, position, wordRegex) {
	const { row, column } = position;
	const rowRange = buffer.rangeForRow(row, false);
	let matchData;
	// Extract the expression from the row text.
	buffer.scanInRange(wordRegex, rowRange, (data) => {
		const { range } = data;
		if (position.isGreaterThanOrEqual(range.start) &&
			// Range endpoints are exclusive.
			position.isLessThan(range.end)) {
			matchData = data;
			data.stop();
			return;
		}
		// Stop the scan if the scanner has passed our position.
		if (range.end.column > column) {
			data.stop();
		}
	});
	return matchData == null ? null : matchData.range;
}
/** End methods from atom-languageclient/utils **/
