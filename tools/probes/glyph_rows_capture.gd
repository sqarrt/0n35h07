extends SceneTree
## Probe: the web glyph-position rows (parity-probe-glyph-positions.mjs) drawn glyph by glyph at Chrome's fractional pen
## positions three ways — at the rounded font size (column 0), at the fractional CSS size through a scaled draw with
## matching oversampling (column 1), and that again without hinting (column 2) — so the frame shows which rendering
## matches Chrome's pixels. Run with a real renderer:
##   --path . --resolution 1280x720 -s tools/probes/glyph_rows_capture.gd

const OUTPUT := "res://test-results/probes/glyph-positions/godot-glyph-variants.png"
const RUN := "000000000000000000000000"
const ROWS := [[12.5, 0.04], [16.0, 0.18], [11.2, 0.15], [13.6, 0.18]]   # web ROWS without the 24 px title
const LEFT := 20.0
const TOP := 20.0
const ROW_GAP := 40.0
const COLUMN_GAP := 420.0
const BACKGROUND := Color("#0a0c11")
const SETTLE_FRAMES := 10

## A run drawn glyph by glyph at Chrome's pen step (advance plus letter spacing).
class GlyphRow extends Control:
	var css_px := 12.5
	var spacing_em := 0.0
	var fractional_size := false
	var face: Font = null
	var text := ""

	func _draw() -> void:
		var font_size := UiFont.css_size(css_px)
		var font := UiFont.with_css_line(UiFont.spaced(0.0, font_size, css_px, face), font_size, css_px)
		var line := TextLine.new()
		line.add_string(text, font, font_size)
		var server := TextServerManager.get_primary_interface()
		var step := UiFont.css_width("0", css_px, spacing_em)
		var scale := css_px / font_size if fractional_size else 1.0
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE * scale)
		var baseline := font.get_ascent(font_size)
		var pen := 0.0
		for glyph in server.shaped_text_get_glyphs(line.get_rid()):
			server.font_draw_glyph(glyph["font_rid"], get_canvas_item(), glyph["font_size"],
				Vector2(pen / scale, baseline) + glyph["offset"], glyph["index"], Color.WHITE, scale)
			pen += step

func _initialize() -> void:
	root.content_scale_factor = 1.0
	var unhinted := (UiFont.base().duplicate() as FontFile)
	unhinted.hinting = TextServer.HINTING_NONE
	var background := ColorRect.new()
	background.color = BACKGROUND
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.add_child(background)
	for i in ROWS.size():
		for column in 3:
			var row := GlyphRow.new()
			row.css_px = ROWS[i][0]
			row.spacing_em = ROWS[i][1]
			row.fractional_size = column >= 1
			row.face = unhinted if column == 2 else null
			row.text = RUN
			row.position = Vector2(LEFT + column * COLUMN_GAP, TOP + i * ROW_GAP)
			row.size = Vector2(COLUMN_GAP, ROW_GAP)
			background.add_child(row)
	for i in SETTLE_FRAMES:
		await process_frame
	await RenderingServer.frame_post_draw
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT.get_base_dir()))
	root.get_texture().get_image().save_png(ProjectSettings.globalize_path(OUTPUT))
	quit()
