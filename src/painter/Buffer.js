export default class DynamicBuffer {
    constructor(initialVertexCapacity = 65536, initialElementCapacity = 65536) {
        this.vertexArray = new Float32Array(initialVertexCapacity);
        this.vertexOffset = 0;

        this.elementArray = new Uint32Array(initialElementCapacity);
        this.elementOffset = 0;
    }

    pushVertex(...args) {
        const len = args.length;
        if (this.vertexOffset + len > this.vertexArray.length) {
            const newArray = new Float32Array(this.vertexArray.length * 2 + len);
            newArray.set(this.vertexArray);
            this.vertexArray = newArray;
        }
        for (let i = 0; i < len; i++) {
            this.vertexArray[this.vertexOffset++] = args[i];
        }
    }

    pushVertexArray(arr) {
        const len = arr.length;
        if (this.vertexOffset + len > this.vertexArray.length) {
            const newArray = new Float32Array(Math.max(this.vertexArray.length * 2, this.vertexOffset + len));
            newArray.set(this.vertexArray);
            this.vertexArray = newArray;
        }
        this.vertexArray.set(arr, this.vertexOffset);
        this.vertexOffset += len;
    }

    pushElement(...args) {
        const len = args.length;
        if (this.elementOffset + len > this.elementArray.length) {
            const newArray = new Uint32Array(this.elementArray.length * 2 + len);
            newArray.set(this.elementArray);
            this.elementArray = newArray;
        }
        for (let i = 0; i < len; i++) {
            this.elementArray[this.elementOffset++] = args[i];
        }
    }

    pushElementArray(arr) {
        const len = arr.length;
        if (this.elementOffset + len > this.elementArray.length) {
            const newArray = new Uint32Array(Math.max(this.elementArray.length * 2, this.elementOffset + len));
            newArray.set(this.elementArray);
            this.elementArray = newArray;
        }
        this.elementArray.set(arr, this.elementOffset);
        this.elementOffset += len;
    }

    getArrays() {
        return {
            vertexArray: new Float32Array(this.vertexArray.buffer, 0, this.vertexOffset),
            elementArray: new Uint32Array(this.elementArray.buffer, 0, this.elementOffset)
        };
    }
}
