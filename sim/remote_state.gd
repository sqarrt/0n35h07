class_name RemoteState extends RefCounted
## A player seen from outside — web Player.applyNetState (netWindup, netDashing, netShieldActive) plus the demo frame's
## HUD readiness: what another peer or a recording says about the shot charge, the dash, the shield and the cooldowns,
## read by the visuals and the HUD instead of a local simulation. Readiness is 1 when nobody said otherwise.

const READY := 1.0

var windup := 0.0
var dashing := false
var shield := false
var beam_progress := READY
var dash_progress := READY
var shield_progress := READY
