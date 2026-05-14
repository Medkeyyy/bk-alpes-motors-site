/* =============================================
   BK ALPES MOTORS — hero3d.js
   Three.js scene: low-poly car + particles
   ============================================= */

(function () {
  'use strict';

  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  const canvas = document.getElementById('heroCanvas');
  if (!canvas || typeof THREE === 'undefined') return;

  /* ---- Renderer ---- */
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !isMobile });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.setSize(canvas.parentElement.offsetWidth, canvas.parentElement.offsetHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = !isMobile;

  /* ---- Scene ---- */
  const scene = new THREE.Scene();

  /* ---- Camera ---- */
  const camera = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 0.1, 100);
  camera.position.set(0, 1.5, 6);
  camera.lookAt(0, 0, 0);

  /* ---- Lighting ---- */
  // Ambient
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);

  // Main white light (top)
  const mainLight = new THREE.DirectionalLight(0xffffff, 1.4);
  mainLight.position.set(3, 6, 4);
  mainLight.castShadow = !isMobile;
  scene.add(mainLight);

  // Rim light — mint green
  const rimLight = new THREE.DirectionalLight(0x40FFA7, 1.8);
  rimLight.position.set(-4, 2, -3);
  scene.add(rimLight);

  // Fill light — navy blue
  const fillLight = new THREE.DirectionalLight(0x0510a0, 0.6);
  fillLight.position.set(2, -1, 4);
  scene.add(fillLight);

  // Ground bounce
  const groundLight = new THREE.HemisphereLight(0x080808, 0x40FFA7, 0.4);
  scene.add(groundLight);

  /* ---- Ground plane (reflective) ---- */
  const groundGeo = new THREE.PlaneGeometry(20, 20);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x080808,
    roughness: 0.8,
    metalness: 0.3,
    transparent: true,
    opacity: 0.6,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.1;
  ground.receiveShadow = true;
  scene.add(ground);

  /* ---- Particles ---- */
  const particleCount = isMobile ? 300 : 800;
  const particleGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 16;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 12;
    sizes[i] = Math.random() * 2 + 0.5;
  }

  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const particleMat = new THREE.PointsMaterial({
    color: 0x40FFA7,
    size: 0.04,
    transparent: true,
    opacity: 0.35,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  /* ---- Car Group (pivot) ---- */
  const carGroup = new THREE.Group();
  scene.add(carGroup);

  /* ---- Load GLB Model ---- */
  let carLoaded = false;

  function loadGLTF() {
    // Use GLTFLoader from Three.js examples via CDN
    const loaderScript = document.createElement('script');
    loaderScript.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
    loaderScript.onload = () => {
      const loader = new THREE.GLTFLoader();
      const modelUrl = 'https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/low-poly-car/model.gltf';

      loader.load(
        modelUrl,
        (gltf) => {
          const model = gltf.scene;

          // Center & scale
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2.4 / maxDim;

          model.position.sub(center);
          model.scale.setScalar(scale);

          // Material override — dark metallic with mint tint
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = !isMobile;
              child.receiveShadow = !isMobile;
              if (child.material) {
                child.material = new THREE.MeshStandardMaterial({
                  color: child.material.color || new THREE.Color(0x111111),
                  roughness: 0.3,
                  metalness: 0.8,
                  envMapIntensity: 1.0,
                });
              }
            }
          });

          carGroup.add(model);
          carLoaded = true;
        },
        undefined,
        (err) => {
          console.warn('GLB load failed, using fallback geometry.', err);
          buildFallbackCar();
        }
      );
    };
    loaderScript.onerror = () => buildFallbackCar();
    document.head.appendChild(loaderScript);
  }

  /* ---- Fallback car geometry ---- */
  function buildFallbackCar() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.25,
      metalness: 0.85,
    });
    const mintMat = new THREE.MeshStandardMaterial({
      color: 0x40FFA7,
      roughness: 0.3,
      metalness: 0.9,
      emissive: 0x40FFA7,
      emissiveIntensity: 0.2,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x1a2a3a,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.7,
    });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, 1.4), mat);
    body.position.y = 0;
    carGroup.add(body);

    // Cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.2), glassMat);
    cabin.position.set(-0.1, 0.55, 0);
    carGroup.add(cabin);

    // Roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 1.1), mat);
    roof.position.set(-0.1, 0.82, 0);
    carGroup.add(roof);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.22, 12);
    const wheelPositions = [
      [-0.9, -0.28, 0.78], [-0.9, -0.28, -0.78],
      [0.9, -0.28, 0.78],  [0.9, -0.28, -0.78],
    ];
    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeo, mat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(...pos);
      carGroup.add(wheel);

      // Rim
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.24, 8), mintMat);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(...pos);
      carGroup.add(rim);
    });

    // Headlights
    const headlightGeo = new THREE.BoxGeometry(0.1, 0.15, 0.35);
    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0x40FFA7, emissive: 0x40FFA7, emissiveIntensity: 1.5,
      roughness: 0, metalness: 0,
    });
    [-0.3, 0.3].forEach(z => {
      const hl = new THREE.Mesh(headlightGeo, headlightMat);
      hl.position.set(1.55, 0.05, z);
      carGroup.add(hl);
    });

    // Logo accent stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.6), mintMat);
    stripe.position.set(1.52, 0.15, 0);
    carGroup.add(stripe);

    carGroup.position.y = -0.5;
    carLoaded = true;
  }

  /* ---- OrbitControls (manual, lightweight) ---- */
  let isDragging = false;
  let previousMouseX = 0;
  let previousMouseY = 0;
  let rotationY = 0;
  let rotationX = 0;
  const autoRotateSpeed = 0.003;

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    previousMouseX = e.clientX;
    previousMouseY = e.clientY;
  });

  window.addEventListener('mouseup', () => { isDragging = false; });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - previousMouseX;
    const dy = e.clientY - previousMouseY;
    rotationY += dx * 0.008;
    rotationX += dy * 0.004;
    rotationX = Math.max(-0.4, Math.min(0.4, rotationX));
    previousMouseX = e.clientX;
    previousMouseY = e.clientY;
  });

  // Touch support
  canvas.addEventListener('touchstart', (e) => {
    isDragging = true;
    previousMouseX = e.touches[0].clientX;
    previousMouseY = e.touches[0].clientY;
  }, { passive: true });

  canvas.addEventListener('touchend', () => { isDragging = false; }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const dx = e.touches[0].clientX - previousMouseX;
    const dy = e.touches[0].clientY - previousMouseY;
    rotationY += dx * 0.008;
    rotationX += dy * 0.004;
    rotationX = Math.max(-0.4, Math.min(0.4, rotationX));
    previousMouseX = e.touches[0].clientX;
    previousMouseY = e.touches[0].clientY;
  }, { passive: true });

  /* ---- Resize ---- */
  function onResize() {
    const parent = canvas.parentElement;
    const w = parent.offsetWidth;
    const h = parent.offsetHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize, { passive: true });

  /* ---- Animation Loop ---- */
  let frameId;
  let lastTime = 0;

  function animate(time) {
    frameId = requestAnimationFrame(animate);

    const delta = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    // Auto rotate
    if (!isDragging) {
      rotationY += autoRotateSpeed;
    }

    carGroup.rotation.y = rotationY;
    carGroup.rotation.x = rotationX;

    // Floating bob
    carGroup.position.y = Math.sin(time * 0.0008) * 0.08 - (carLoaded ? 0 : 0.5);

    // Particle drift
    particles.rotation.y += delta * 0.02;
    particles.rotation.x += delta * 0.008;

    renderer.render(scene, camera);
  }

  /* ---- Start ---- */
  // Load model when page is idle to avoid blocking
  if ('requestIdleCallback' in window) {
    requestIdleCallback(loadGLTF, { timeout: 2000 });
  } else {
    setTimeout(loadGLTF, 500);
  }

  animate(0);

  /* ---- Cleanup on page hide ---- */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(frameId);
    } else {
      animate(0);
    }
  });

})();
