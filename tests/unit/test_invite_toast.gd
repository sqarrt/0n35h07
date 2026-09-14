extends GutTest
## The Steam invite toast (web components/InviteModal + InviteModal.css + glass.ts): 240 px wide 18 px from the right and
## 132 px from the bottom once slid in, the name before "invites you to a game", Accept / Decline on rounded 8 px boxes
## that answer with the lobby and the inviter, the newest invite replacing the text in place, and the glass passes.

const SCREEN := Vector2i(1280, 720)
const EPS := 0.01

func _toast() -> InviteToast:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var holder := Control.new()
	holder.size = Vector2(SCREEN)
	viewport.add_child(holder)
	var toast := InviteToast.new()
	toast.show_invite("PARITY7", "300", "555")
	holder.add_child(toast)
	await wait_process_frames(2)
	return toast

func test_slides_into_the_corner() -> void:
	var toast := await _toast()
	for i in 30:
		toast._process(1.0 / 60.0)
	assert_almost_eq(toast.modulate.a, 1.0, EPS)
	var rect := toast.get_rect()
	assert_almost_eq(rect.size.x, InviteToast.WIDTH, EPS)
	assert_almost_eq(rect.end.x, SCREEN.x - InviteToast.RIGHT, EPS, "right: 18px")
	assert_almost_eq(rect.end.y, SCREEN.y - InviteToast.BOTTOM, 1.0, "bottom: 132px")

func test_starts_hidden_to_the_right() -> void:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var toast := InviteToast.new()
	viewport.add_child(toast)
	assert_almost_eq(toast.modulate.a, 0.0, EPS, "invite-in from opacity 0")
	assert_almost_eq(toast.offset_right, -InviteToast.RIGHT + InviteToast.ENTER_SHIFT, EPS, "from translateX(22px)")

func test_texts_and_answers() -> void:
	var toast := await _toast()
	var title := toast.find_child("Title", true, false) as RichTextLabel
	assert_eq(title.get_parsed_text(), "PARITY7 invites you to a game")
	assert_eq(title.get_line_count(), 1, "one line in 208 px, like Chrome")
	var accept := toast.find_child("Accept", true, false) as UiButton
	var decline := toast.find_child("Decline", true, false) as UiButton
	assert_eq([accept.text, decline.text], ["Accept", "Decline"])
	assert_eq((accept.get_theme_stylebox("normal") as StyleBoxFlat).corner_radius_top_left, InviteToast.BUTTON_RADIUS)
	assert_almost_eq(accept.size.x + decline.size.x + InviteToast.ROW_GAP, 208.0, 1.0, "two flex halves of 240 − 2·16")
	watch_signals(toast)
	accept.pressed.emit()
	decline.pressed.emit()
	assert_signal_emitted_with_parameters(toast, "accepted", ["555"])
	assert_signal_emitted_with_parameters(toast, "declined", ["300"])

func test_a_newer_invite_replaces_the_text() -> void:
	var toast := await _toast()
	toast.show_invite("OTHER", "301", "556")
	assert_eq((toast.find_child("Title", true, false) as RichTextLabel).get_parsed_text(), "OTHER invites you to a game")
	watch_signals(toast)
	(toast.find_child("Accept", true, false) as UiButton).pressed.emit()
	assert_signal_emitted_with_parameters(toast, "accepted", ["556"])

func test_the_pressed_box_moves_down_one_pixel() -> void:
	var toast := await _toast()
	var accept := toast.find_child("Accept", true, false) as UiButton
	var pressed := accept.get_theme_stylebox("pressed") as StyleBoxFlat
	var normal := accept.get_theme_stylebox("normal") as StyleBoxFlat
	assert_eq(pressed.expand_margin_bottom - normal.expand_margin_bottom, float(InviteToast.BUTTON_PRESS_PX))
	assert_eq(pressed.get_minimum_size(), normal.get_minimum_size(), "the row does not jump")
	var surface := (toast.find_child("Surface", true, false) as ColorRect).material as ShaderMaterial
	assert_almost_eq(float(surface.get_shader_parameter("sigma")), GlassCard.BACKDROP_SIGMA, EPS)
	assert_almost_eq(float(surface.get_shader_parameter("shadow_sigma")), 20.0, EPS, "blur 40px = 2σ")
