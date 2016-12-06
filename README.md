# kube-tails

Multi-tail for Kubernetes pods, more or less.

I wrote this before I knew about https://github.com/wercker/stern, which you should check out and use first. (See the [blog post](http://blog.kubernetes.io/2016/10/tail-kubernetes-with-stern.html).)

About the code: Apologies; I don't even node. 

Maybe do this:

```
npm install
npm link

kube-tails <pod-name-pattern> --exclude healthcheck
```

![example screen capture](docs/media/screencap.gif)