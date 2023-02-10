import os

input_dir = 'src/assets/simdata/'

def run(simulation):
    queues = []
    for filename in os.listdir(input_dir):
        f = os.path.join(input_dir, filename)
        # checking if it is a file
        if os.path.isfile(f):
            print(f)

run('wind')