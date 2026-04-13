let nextUnitOfWork = null
let currentRoot = null
let wipRoot = null
let deletions = null

// --- MISSÃO 4: Cursores globais para os Hooks ---
let wipFiber = null
let hookIndex = null

// --- MISSÃO 1: Criando a árvore de elementos ---
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(child =>
        typeof child === "object"
          ? child
          : createTextElement(child)
      ),
    },
  }
}

function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  }
}

// --- MISSÃO 3.1: Render Phase ---
// Substitui a renderização síncrona: configura a wipRoot (work-in-progress root)
// para calcularmos as mudanças sem travar a thread principal (sem tocar no DOM ainda).
function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot, // Aponta para a árvore refletida no DOM atualmente
  }

  deletions = []
  nextUnitOfWork = wipRoot // Inicia o trabalho do Scheduler
}

// --- MISSÃO 2: Scheduler e Loop de Trabalho ---
function workLoop(deadline) {
  let shouldYield = false

  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    shouldYield = deadline.timeRemaining() < 1
  }

  if (!nextUnitOfWork && wipRoot) {
    commitRoot()
  }

  requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

function performUnitOfWork(fiber) {
  const isFunctionComponent = fiber.type instanceof Function

  if (isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
  }

  // Navegação: 1. Vai para o primeiro filho, se existir
  if (fiber.child) return fiber.child

  let nextFiber = fiber
  while (nextFiber) {
    // Navegação: 2. Vai para o irmão, se existir
    if (nextFiber.sibling) return nextFiber.sibling
    // Navegação: 3. Se não tem irmão, volta para o pai e procura o irmão do pai (uncle)
    nextFiber = nextFiber.parent
  }

  return null
}

// --- MISSÃO 4: updateFunctionComponent atualizado ---
function updateFunctionComponent(fiber) {
  // Prepara o cursor para o hook
  wipFiber = fiber
  hookIndex = 0
  wipFiber.hooks = []
  
  // Quando chamamos fiber.type(fiber.props), qualquer chamada de useState
  // dentro do componente conseguirá ler e alterar os cursores acima.
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}

// --- MISSÃO 4: Implementação do useState ---
function useState(initial) {
  // 1. Recupera o estado antigo
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]

  // 2. Inicializa o novo hook
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  }

  // 3. Processa a fila de atualizações (Batching)
  const actions = oldHook ? oldHook.queue : []
  actions.forEach(action => {
    hook.state = typeof action === "function" ? action(hook.state) : action
  })

  // 4. O Dispatcher (setState)
  const setState = action => {
    hook.queue.push(action)
    
    // Configura o wipRoot para iniciar uma nova renderização (acorda o Work Loop)
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    }
    nextUnitOfWork = wipRoot
    deletions = []
  }

  // 5. Avança o cursor
  wipFiber.hooks.push(hook)
  hookIndex++

  return [hook.state, setState]
}

function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }

  reconcileChildren(fiber, fiber.props.children)
}

function createDom(fiber) {
  const dom =
    fiber.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type)

  updateDom(dom, {}, fiber.props)
  return dom
}

// --- MISSÃO 3.3: Reconciliação (Diffing Algorithm) ---
function reconcileChildren(wipFiber, elements) {
  let index = 0
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child
  let prevSibling = null

  while (index < elements.length || oldFiber != null) {
    const element = elements[index]
    let newFiber = null

    const sameType =
      oldFiber &&
      element &&
      element.type === oldFiber.type

    // Case 1: same type → UPDATE
    // O tipo do elemento é o mesmo, reciclamos o nó do DOM existente
    if (sameType) {
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      }
    }

    // Case 2: new element, different type → PLACEMENT
    // O tipo é diferente ou é novo, precisamos criar um nó DOM do zero
    if (element && !sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT",
      }
    }

    // Case 3: old fiber exists, different type → DELETION
    // O nó antigo é obsoleto, marcamos para deletar do DOM
    if (oldFiber && !sameType) {
      oldFiber.effectTag = "DELETION"
      deletions.push(oldFiber)
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling
    }

    if (index === 0) {
      wipFiber.child = newFiber
    } else if (prevSibling) {
      prevSibling.sibling = newFiber
    }

    prevSibling = newFiber
    index++
  }
}

// --- MISSÃO 3.1: Commit Phase ---
// Aplica todas as mudanças de uma vez ao DOM (fase atômica) para evitar UI quebrado
function commitRoot() {
  // Remove nós marcados com DELETION
  deletions.forEach(commitWork)
  // Aplica PLACEMENT e UPDATE a partir do primeiro filho da wipRoot
  commitWork(wipRoot.child)
  // Atualiza a árvore atual (currentRoot) refletindo o novo estado do DOM
  currentRoot = wipRoot
  wipRoot = null
}

function commitWork(fiber) {
  if (!fiber) return

  // Sobe a árvore de fibers para encontrar o primeiro pai que possui um nó de DOM real
  let domParentFiber = fiber.parent
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent
  }
  const domParent = domParentFiber.dom

  // Baseado na tag calculada na reconciliação, aplica a mutação correspondente no DOM
  if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
    // Adiciona novo elemento visual ao DOM
    domParent.appendChild(fiber.dom)
  } else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
    // Atualiza atributos/eventos reciclando o elemento visual já existente
    updateDom(fiber.dom, fiber.alternate.props, fiber.props)
  } else if (fiber.effectTag === "DELETION") {
    // Remove o elemento visual obsoleto
    commitDeletion(fiber, domParent)
  }

  // Continua a aplicação para os filhos e depois para os irmãos (ordem determinística)
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

function commitDeletion(fiber, domParent) {
  // Se a fiber tem um nó DOM (ex: elementos HTML), remove do pai.
  // Se for um componente funcional (que não tem DOM próprio), desce para os filhos recursivamente.
  if (fiber.dom) {
    domParent.removeChild(fiber.dom)
  } else {
    commitDeletion(fiber.child, domParent)
  }
}

// --- MISSÃO 3.2: updateDom ---
const isEvent = key => key.startsWith("on")
const isProperty = key => key !== "children" && !isEvent(key)
// Funções auxiliares para filtrar apenas o que de fato mudou (performance)
const isNew = (prev, next) => key => prev[key] !== next[key]
const isGone = (prev, next) => key => !(key in next)

function updateDom(dom, prevProps, nextProps) {
  // 1. Remove event listeners antigos ou que sofreram alterações
  Object.keys(prevProps)
    .filter(isEvent)
    .filter(key => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2)
      dom.removeEventListener(eventType, prevProps[name])
    })

  // 2. Remove propriedades normais que não existem mais
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach(name => {
      dom[name] = ""
    })

  // 3. Define propriedades novas ou que tiveram seus valores alterados
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      dom[name] = nextProps[name]
    })

  // 4. Adiciona event listeners novos ou alterados
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2)
      dom.addEventListener(eventType, nextProps[name])
    })
}

// Adicionamos o useState aqui para ser consumido em outros arquivos!
const Didact = {
  createElement,
  render,
  useState, 
}

// --- CÓDIGO DE TESTE MISSÃO 4 ---
const container = document.getElementById("root");

// Um Componente Funcional de verdade!
function Greeting(props) {
  return Didact.createElement(
    "h1", 
    { style: "color: green; font-family: sans-serif;" }, 
    "Mission 4: Hello, ", 
    props.name, 
    "!"
  );
}

const App = Didact.createElement(Greeting, { name: "Function Components" });

Didact.render(App, container);