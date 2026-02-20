import json
import numpy as np

def compute_vector(obj_vertices):
    centroid = np.mean(obj_vertices, axis=0)
    normal = np.cross(obj_vertices[1] - obj_vertices[0],
                      obj_vertices[2] - obj_vertices[0])

    ingress = centroid / np.linalg.norm(centroid)
    direction = normal / np.linalg.norm(normal)

    dotp = float(np.dot(ingress, direction))
    return {
        "centroid": centroid.tolist(),
        "normal": direction.tolist(),
        "dot_product": dotp
    }

if __name__ == "__main__":
    # Replace with OBJ parser — omitted for brevity, stays safe
    vertices = np.array([[1,0,0],[0,1,0],[0,0,1]])
    vector = compute_vector(vertices)
    with open("build/ingress_vector.json","w") as f:
        json.dump(vector,f,indent=2)
