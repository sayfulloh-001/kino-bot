/**
 * Procedural Animation Manager for Stylized Characters.
 */

export class AnimationManager {
    constructor() {
        this.time = 0;
    }

    /**
     * Animate player parts based on state.
     * @param {object} playerParts - References to character limb meshes
     * @param {string} state - Player state ('idle', 'run', 'jump', 'roll', 'hit')
     * @param {number} delta - Frame delta time in seconds
     * @param {number} speed - Game forward speed
     */
    animate(playerParts, state, delta, speed) {
        if (!playerParts) return;

        this.time += delta * speed * 0.8; // Scaling animation frequency with speed

        const { leftLeg, rightLeg, leftArm, rightArm, head, body, board } = playerParts;

        // Reset default rotations
        if (state !== 'roll') {
            body.rotation.x = 0;
            body.rotation.y = 0;
            body.rotation.z = 0;
        }

        switch (state) {
            case 'idle':
                // Slow breathing breathing wave
                const breath = Math.sin(Date.now() * 0.003) * 0.05;
                body.position.y = 0.9 + breath;
                head.position.y = 0.7 + breath * 0.2;
                
                leftLeg.rotation.x = 0;
                rightLeg.rotation.x = 0;
                leftArm.rotation.x = Math.sin(Date.now() * 0.001) * 0.1;
                rightArm.rotation.x = -Math.sin(Date.now() * 0.001) * 0.1;
                break;

            case 'run':
                // Leg swing back and forth
                const angle = Math.sin(this.time) * 0.8;
                leftLeg.rotation.x = angle;
                rightLeg.rotation.x = -angle;

                // Arm swing opposite to leg swing
                leftArm.rotation.x = -angle * 0.6;
                rightArm.rotation.x = angle * 0.6;
                
                // Slight head bobbing
                head.rotation.x = Math.cos(this.time * 2) * 0.05;
                
                // Slight body bobbing
                body.position.y = 0.9 + Math.abs(Math.sin(this.time)) * 0.1;
                break;

            case 'jump':
                // Spread arms and pull legs up
                leftLeg.rotation.x = -0.4;
                rightLeg.rotation.x = -0.4;
                leftArm.rotation.z = 0.8;
                rightArm.rotation.z = -0.8;
                leftArm.rotation.x = 0;
                rightArm.rotation.x = 0;
                body.position.y = 0.9;
                break;

            case 'roll':
                // Spin body rapidly around x-axis
                const spinSpeed = 10;
                body.rotation.x += delta * spinSpeed;
                leftLeg.rotation.x = -0.6;
                rightLeg.rotation.x = -0.6;
                leftArm.rotation.x = -0.6;
                rightArm.rotation.x = -0.6;
                body.position.y = 0.5;
                break;

            case 'hit':
                // Reeling backward animation
                body.rotation.x = -0.5;
                leftArm.rotation.x = 1.0;
                rightArm.rotation.x = 1.0;
                leftLeg.rotation.x = 0.3;
                rightLeg.rotation.x = -0.3;
                body.position.y = 0.8;
                break;
        }

        // Animate Hoverboard if active
        if (board && board.visible) {
            board.rotation.z = Math.sin(Date.now() * 0.01) * 0.05;
            board.position.y = -0.7 + Math.cos(Date.now() * 0.01) * 0.03;
        }
    }
}

export const animationManager = new AnimationManager();
export default animationManager;
