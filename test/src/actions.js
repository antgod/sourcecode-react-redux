/*
 * action 类型
 */

export const ADD_TODO = 'ADD_TODO';
export const COMPLETE_TODO = 'COMPLETE_TODO';
export const SET_VISIBILITY_FILTER = 'SET_VISIBILITY_FILTER'

/*
 * 其它的常量
 */

export const VisibilityFilters = {
  SHOW_ALL: 'SHOW_ALL',
  SHOW_COMAPLETED: 'SHOW_COMPLETED',
  SHOW_ACTIVE: 'SHOW_ACTIVE'
};

/*
 * action 创建函数
 */

export function addTodo(text) {
  return { type: ADD_TODO, text }
}

export function completeTodo(index) {
  return { type: COMPLETE_TODO, index }
}

export function setVisibilityFilter(filter) {
  return { type: SET_VISIBILITY_FILTER, filter }
}

export function addTodoAsync(text) {
  return dispatch => {
    setTimeout(() => {
      dispatch(addTodo(text));
    }, 1000);
  }
}

export function addTodoPromise(text) {
  return new Promise((res, rej) => {
    setTimeout(() => {
      res({ text })
    }, 1000);
  }).then(response => ({
    type: 'ADD_TODO',
    text: response.text,
  }))
}

export default {
  addTodo, completeTodo, setVisibilityFilter, addTodoAsync, addTodoPromise,
}