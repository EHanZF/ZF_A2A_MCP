FROM alpine:3.20

RUN echo "hello from $(uname -m)" > /image-arch.txt

CMD [ "sh", "-c", "echo built_for=$(cat /image-arch.txt); echo runtime=$(uname -m); cat /etc/os-release | head -n1" ]
