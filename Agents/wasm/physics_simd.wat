(module
  (memory (export "mem") 1)
  (global $dt (mut f32) (f32.const 0.016))

  ;; Positions and velocities stored linearly: [x y z vx vy vz]
  (func (export "step_physics")
    (local $i i32)
    (local $base i32)

    (local.set $i (i32.const 0))
    (loop $loop
      (local.set $base (i32.mul (local.get $i) (i32.const 24))) ;; 6 floats * 4 bytes

      ;; load pos (x y z) and vel (vx vy vz) as SIMD vectors
      (local $pos v128)
      (local $vel v128)

      (local.set $pos (v128.load (local.get $base)))
      (local.set $vel (v128.load (i32.add (local.get $base) (i32.const 12))))

      ;; pos += vel * dt
      (local.set $vel
        (f32x4.mul (local.get $vel)
                   (f32x4.splat (global.get $dt))))
      (local.set $pos (f32x4.add (local.get $pos) (local.get $vel)))

      ;; store new pos
      (v128.store (local.get $base) (local.get $pos))

      ;; increment element index
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $loop (i32.lt_u (local.get $i) (i32.const 1)))
    )
  )
)
