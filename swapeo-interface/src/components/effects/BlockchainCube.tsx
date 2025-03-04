import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import './BlockchainCube.css';

const BlockchainCube: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Clear any existing content
    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild);
    }

    // Create new scene only if it doesn't exist
    if (!sceneRef.current) {
      sceneRef.current = new THREE.Scene();
    }
    const scene = sceneRef.current;

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 10;

    // Create new renderer only if it doesn't exist
    if (!rendererRef.current) {
      rendererRef.current = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true 
      });
    }
    const renderer = rendererRef.current;
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    containerRef.current.appendChild(renderer.domElement);

    // Clear any existing objects from the scene
    while(scene.children.length > 0){ 
      scene.remove(scene.children[0]); 
    }

    // Create the cube
    const geometry = new THREE.BoxGeometry(6, 6, 6);
    const edges = new THREE.EdgesGeometry(geometry);
    const cube = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ 
        color: 0x4CAF50,
        linewidth: 2
      })
    );
    scene.add(cube);

    // Add lighting
    const light = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(light);

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (cube) {
        cube.rotation.x += 0.002;
        cube.rotation.y += 0.002;
      }
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      
      // Dispose of geometries and materials
      geometry.dispose();
      edges.dispose();
      cube.material.dispose();
      
      // Remove cube from scene
      scene.remove(cube);
      
      // Clear renderer
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="blockchain-cube" />;
};

export default BlockchainCube; 