import React, { Component, PropTypes } from 'react'
import ReactDOM  from 'react-dom'
import { createStore, bindActionCreators, applyMiddleware, compose } from 'redux'
import connect from '../../src/components/connect'
import Provider from '../../src/components/Provider'
import ReduxThunk from 'redux-thunk'
import actions, { VisibilityFilters } from './actions'
import AddTodo from './components/AddTodo'
import TodoList from './components/TodoList'
import Footer from './components/Footer'
import todoApp from './reducers'

class App extends Component {
  render() {
    const { visibleTodos, visibilityFilter, actions } = this.props
    return (
      <div>
        <AddTodo
          onAddClick={text =>
            actions.addTodo(text)
          }
          onAddClickAsync={text =>
            actions.addTodoAsync(text)
          }
          onAddClickPromise={text =>
            actions.addTodoPromise(text)
          }
        />
        <TodoList
          todos={visibleTodos}
          onTodoClick={index =>
            actions.completeTodo(index)
          }/>
        <Footer
          filter={visibilityFilter}
          onFilterChange={nextFilter =>
            actions.setVisibilityFilter(nextFilter)
          }/>
      </div>
    )
  }
}

App.propTypes = {
  visibleTodos: PropTypes.arrayOf(PropTypes.shape({
    text: PropTypes.string.isRequired,
    completed: PropTypes.bool.isRequired
  }).isRequired).isRequired,
  visibilityFilter: PropTypes.oneOf([
    'SHOW_ALL',
    'SHOW_COMPLETED',
    'SHOW_ACTIVE'
  ]).isRequired
}

function selectTodos(todos, filter) {
  switch (filter) {
    case VisibilityFilters.SHOW_ALL:
      return todos
    case VisibilityFilters.SHOW_COMPLETED:
      return todos.filter(todo => todo.completed)
    case VisibilityFilters.SHOW_ACTIVE:
      return todos.filter(todo => !todo.completed)
  }
}

// Which props do we want to inject, given the global state?
// Note: use https://github.com/faassen/reselect for better performance.
function select(state) {
  return {
    visibleTodos: selectTodos(state.todos, state.visibilityFilter),
    visibilityFilter: state.visibilityFilter
  }
}

function mapDispatchToProps(dispatch) {
  return { actions: bindActionCreators(actions, dispatch) }
}

const FinalApp = connect(select, mapDispatchToProps)(App)

// 包装 component ，注入 dispatch 和 state 到其默认的 connect(select)(App) 中；

const logger = store => next => action => {
  console.log('logger: ', action);
  next(action);
  console.log('logger finish: ', action);
}

const thunk = ({ dispatch, getState }) => next => action => {
  if (typeof action === 'function') {
    return action(dispatch);
  }

  return next(action);
}

const promise = ({ dispatch }) => next => action => {
  function isPromise(val) {
    return val && typeof val.then === 'function';
  }
  // 如果action是异步函数，则dispatch后直接返回数据，当然数据需要经过ActionCreate包装处理
  return isPromise(action)
    ? action.then(dispatch)
    : next(action);

  return next(action)
}

const finalCreateStore = compose(
  applyMiddleware(logger, promise, thunk)
)(createStore)

let store = finalCreateStore(todoApp)

ReactDOM.render(
  <Provider store={store}>
    <FinalApp />
  </Provider>,
  document.getElementById('app')
)