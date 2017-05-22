import { Component, createElement, PropTypes } from 'react'
import shallowEqual from '../utils/shallowEqual'
import wrapActionCreators from '../utils/wrapActionCreators'
import warning from '../utils/warning'
import isPlainObject from 'lodash/isPlainObject'
import hoistStatics from 'hoist-non-react-statics'
import invariant from 'invariant'

const storeShape = PropTypes.shape({
  subscribe: PropTypes.func.isRequired,
  dispatch: PropTypes.func.isRequired,
  getState: PropTypes.func.isRequired
})


const defaultMapStateToProps = state => ({}) // eslint-disable-line no-unused-vars
const defaultMapDispatchToProps = dispatch => ({ dispatch })
const defaultMergeProps = (stateProps, dispatchProps, parentProps) => ({
  ...parentProps,
  ...stateProps,
  ...dispatchProps
})

function getDisplayName(WrappedComponent) {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component'
}

let errorObject = { value: null }
function tryCatch(fn, ctx) {
  try {
    return fn.apply(ctx)
  } catch (e) {
    errorObject.value = e
    return errorObject
  }
}

// Helps track hot reloading.
let nextVersion = 0

export default function connect(mapStateToProps, mapDispatchToProps, mergeProps, options = {}) {
  // 是否应该订阅，根据传入的map决定，事实上，基本都会订阅
  const shouldSubscribe = Boolean(mapStateToProps)

  // mapState: 传入的函数或者空函数
  const mapState = mapStateToProps || defaultMapStateToProps

  // mapState: 传入的函数或者空函数或者包装函数
  let mapDispatch
  if (typeof mapDispatchToProps === 'function') {
    mapDispatch = mapDispatchToProps
  } else if (!mapDispatchToProps) {
    mapDispatch = defaultMapDispatchToProps
  } else {
    mapDispatch = wrapActionCreators(mapDispatchToProps)
  }

  // mergeProps 参数也是一个函数，接受 stateProps、dispatchProps 和ownProps 作为参数。
  // 实际上， stateProps 就是我们传给 connect 的第一个参数 mapStateToProps 最终返回的 props。同理，
  // dispatchProps 是第二个参数的最终产物，而 ownProps 则是组件自己的 props。
  // 这个方法更大程度上只是为了方便对三种来源的 props 进行更好的分类、命名和重组。
  const finalMergeProps = mergeProps || defaultMergeProps


  // pure配置为 false 时，connect组件接受到属性时，必然刷新。
  // withRef布尔值，默认为 false。如果设置为 true，在装饰传入的 React 组件时，Connect 会保存一个对该组件的 refs 引用，
  // 你可以通过 getWrappedInstance 方法来获得该 refs，并最终获得原始的 DOM 节点。
  const { pure = true, withRef = false } = options
  const checkMergedEquals = pure && finalMergeProps !== defaultMergeProps

  // Helps track hot reloading.
  const version = nextVersion++

  return function wrapWithConnect(WrappedComponent) {
    const connectDisplayName = `Connect(${getDisplayName(WrappedComponent)})`

    function checkStateShape(props, methodName) {
      if (!isPlainObject(props)) {
        warning(
          `${methodName}() in ${connectDisplayName} must return a plain object. ` +
          `Instead received ${props}.`
        )
      }
    }

    function computeMergedProps(stateProps, dispatchProps, parentProps) {
      const mergedProps = finalMergeProps(stateProps, dispatchProps, parentProps)
      if (process.env.NODE_ENV !== 'production') {
        checkStateShape(mergedProps, 'mergeProps')
      }
      return mergedProps
    }

    class Connect extends Component {

      // 生命周期函数
      constructor(props, context) {
        super(props, context)
        this.version = version
        // Provider提供的store
        this.store = props.store || context.store

        // 如果没有传入store并且也没有Provider包装，提出提示
        invariant(this.store,
          `Could not find "store" in either the context or ` +
          `props of "${connectDisplayName}". ` +
          `Either wrap the root component in a <Provider>, ` +
          `or explicitly pass "store" as a prop to "${connectDisplayName}".`
        )

        // 获取store的state
        const storeState = this.store.getState()
        // 把store的state作为组件的state，后面通过更新state更新组件
        this.state = { storeState }
        // 清空缓存值，这里为初始化this信息
        this.clearCache()
      }

      componentDidMount() {
        this.trySubscribe()
      }

      // 组件卸载时候取消订阅，并且清空缓存
      componentWillUnmount() {
        this.tryUnsubscribe()
        this.clearCache()
      }

      componentWillReceiveProps(nextProps) {
        // 当前组件的属性发生变化时候
        if (!pure || !shallowEqual(nextProps, this.props)) {
          this.haveOwnPropsChanged = true
        }
      }

      shouldComponentUpdate() {
        // 如果pure为false 或者 组件自己的属性有变化 或者 storeState有变化，更新组件
        return !pure || this.haveOwnPropsChanged || this.hasStoreStateChanged
      }

      handleChange() {
        // 判断是否已经取消订阅
        if (!this.unsubscribe) {
          return
        }

        // 如果当前状态和上次状态相同，退出
        const storeState = this.store.getState()
        const prevStoreState = this.state.storeState
        if (pure && prevStoreState === storeState) {
          return
        }

        if (pure && !this.doStatePropsDependOnOwnProps) {
          // 当前状态和上次状态浅比较
          const haveStatePropsChanged = tryCatch(this.updateStatePropsIfNeeded, this)
          // 如果没有变化，退出
          if (!haveStatePropsChanged) {
            return
          }
          // 比较出错
          if (haveStatePropsChanged === errorObject) {
            this.statePropsPrecalculationError = errorObject.value
          }
          // 需要预计算
          this.haveStatePropsBeenPrecalculated = true
        }

        // 标记store发生变化
        this.hasStoreStateChanged = true
        // 重新改变state,也就重新触发render
        this.setState({ storeState })
      }

      /* 订阅函数， didUpdate调用 */
      trySubscribe() {
        if (shouldSubscribe && !this.unsubscribe) {
          // store订阅this.handleChange
          this.unsubscribe = this.store.subscribe(this.handleChange.bind(this))
          this.handleChange()
        }
      }

      /* 取消订阅函数, willUnMount调用 */
      tryUnsubscribe() {
        if (this.unsubscribe) {
          this.unsubscribe()
          this.unsubscribe = null
        }
      }

      /* 清空缓存信息, 加载，卸载以及connect属性变化时候触发，connect属性通常不会变化 */
      clearCache() {
        this.dispatchProps = null
        this.stateProps = null
        this.mergedProps = null
        this.haveOwnPropsChanged = true
        this.hasStoreStateChanged = true
        this.haveStatePropsBeenPrecalculated = false
        this.statePropsPrecalculationError = null
        this.renderedElement = null
        this.finalMapDispatchToProps = null
        this.finalMapStateToProps = null
      }


      // 这个逻辑和计算state相同
      configureFinalMapDispatch(store, props) {
        const mappedDispatch = mapDispatch(store.dispatch, props)
        const isFactory = typeof mappedDispatch === 'function'

        this.finalMapDispatchToProps = isFactory ? mappedDispatch : mapDispatch
        // 需要计算的属性依赖自己的属性，当传入两个参数时候重新计算
        this.doDispatchPropsDependOnOwnProps = this.finalMapDispatchToProps.length !== 1

        if (isFactory) {
          return this.computeDispatchProps(store, props)
        }

        if (process.env.NODE_ENV !== 'production') {
          checkStateShape(mappedDispatch, 'mapDispatchToProps')
        }
        return mappedDispatch
      }

      // 深度比较 props是否有变化
      computeDispatchProps(store, props) {
        if (!this.finalMapDispatchToProps) {
          return this.configureFinalMapDispatch(store, props)
        }

        const { dispatch } = store
        const dispatchProps = this.doDispatchPropsDependOnOwnProps ?
          this.finalMapDispatchToProps(dispatch, props) :
          this.finalMapDispatchToProps(dispatch)

        if (process.env.NODE_ENV !== 'production') {
          checkStateShape(dispatchProps, 'mapDispatchToProps')
        }
        return dispatchProps
      }

      // 获得组件当前的state(经过mapPropsToState)的值
      configureFinalMapState(store, props) {
        // mapState是当前组件的mapPropsToState的函数， mappedState是函数的计算结果，也就是当前组件state
        const mappedState = mapState(store.getState(), props)
        const isFactory = typeof mappedState === 'function'

        // 缓存mapStateToProps，如果返回的是函数，就用返回值再当mapStateToProps
        this.finalMapStateToProps = isFactory ? mappedState : mapState

        // 如果参数的长度为不为1，那么依赖于props
        this.doStatePropsDependOnOwnProps = this.finalMapStateToProps.length !== 1

        if (isFactory) {    // 如果返回的是函数，返回computeStateProps再计算值
          return this.computeStateProps(store, props)
        }

        if (process.env.NODE_ENV !== 'production') {
          checkStateShape(mappedState, 'mapStateToProps')
        }

        // 返回map后的state
        return mappedState
      }

      // 深度比较 props是否有变化
      computeStateProps(store, props) {
        // 如果不是第一次计算，从缓存中读取mapPropsToState
        if (!this.finalMapStateToProps) {
          return this.configureFinalMapState(store, props)
        }

        const state = store.getState()

        // 判断mapPropsToState是否依赖自己的属性,如果有，传递自己的属性执行函数
        const stateProps = this.doStatePropsDependOnOwnProps ?
          this.finalMapStateToProps(state, props) :
          this.finalMapStateToProps(state)

        if (process.env.NODE_ENV !== 'production') {
          // 如果stateProps格式不符合要求给出提示
          checkStateShape(stateProps, 'mapStateToProps')
        }
        return stateProps
      }

      // 是否有必要更新state属性，并且计算属性
      updateStatePropsIfNeeded() {
        const nextStateProps = this.computeStateProps(this.store, this.props)
        if (this.stateProps && shallowEqual(nextStateProps, this.stateProps)) {
          return false
        }

        // 更新stateProps为下一个计算后的state
        this.stateProps = nextStateProps
        return true
      }

      // 是否有必要更新事件，并且计算事件
      updateDispatchPropsIfNeeded() {
        const nextDispatchProps = this.computeDispatchProps(this.store, this.props)
        if (this.dispatchProps && shallowEqual(nextDispatchProps, this.dispatchProps)) {
          return false
        }

        this.dispatchProps = nextDispatchProps
        return true
      }

      // 是否必要更新组件所有属性，并且计算所有属性
      updateMergedPropsIfNeeded() {
        const nextMergedProps = computeMergedProps(this.stateProps, this.dispatchProps, this.props)
        if (this.mergedProps && checkMergedEquals && shallowEqual(nextMergedProps, this.mergedProps)) {
          return false
        }

        this.mergedProps = nextMergedProps
        return true
      }

      render() {
        const {
          haveOwnPropsChanged,
          hasStoreStateChanged,
          haveStatePropsBeenPrecalculated,
          statePropsPrecalculationError,
          renderedElement
        } = this

        this.haveOwnPropsChanged = false
        this.hasStoreStateChanged = false
        this.haveStatePropsBeenPrecalculated = false
        this.statePropsPrecalculationError = null

        // 如果组件预计算属性发生异常，报出异常
        if (statePropsPrecalculationError) {
          throw statePropsPrecalculationError
        }

        // 是否再次计算state属性
        let shouldUpdateStateProps = true
        // 是否计算事件属性
        let shouldUpdateDispatchProps = true

        // 判断是否应该更新state与dispatch的属性
        if (pure && renderedElement) {
          // 如果组件storeState发生变化 || 组件自己的属性变化并且mapPropsToState依赖自己的属性
          shouldUpdateStateProps = hasStoreStateChanged || (
            haveOwnPropsChanged && this.doStatePropsDependOnOwnProps
          )

          // 如果组件自己属性变化，事件属性依赖自己的属性
          shouldUpdateDispatchProps =
            haveOwnPropsChanged && this.doDispatchPropsDependOnOwnProps
        }

        let haveStatePropsChanged = false
        let haveDispatchPropsChanged = false

        // 如果已经预计算，那组store的state肯定发生过变化，详见 handleChange
        if (haveStatePropsBeenPrecalculated) {
          haveStatePropsChanged = true
        } else if (shouldUpdateStateProps) {          // 如果没有预计算，重新计算
          haveStatePropsChanged = this.updateStatePropsIfNeeded()
        }

        // 是否应该重新计算dispatch props
        if (shouldUpdateDispatchProps) {
          haveDispatchPropsChanged = this.updateDispatchPropsIfNeeded()
        }

        let haveMergedPropsChanged = true

        // 如果属性变化，dispatch属性变化或者组件自己的属性变化，任一一个都可能触发重新渲染
        if (
          haveStatePropsChanged ||
          haveDispatchPropsChanged ||
          haveOwnPropsChanged
        ) {
          // 计算最终的mergeProps，并且返回是否需要更新组件
          haveMergedPropsChanged = this.updateMergedPropsIfNeeded()
        } else {
          haveMergedPropsChanged = false
        }

        // 如果状态没有任何改变，显示原来的组件
        if (!haveMergedPropsChanged && renderedElement) {
          return renderedElement
        }

        if (withRef) {
          this.renderedElement = createElement(WrappedComponent, {
            ...this.mergedProps,
            ref: 'wrappedInstance'
          })
        } else {
          this.renderedElement = createElement(WrappedComponent,
            this.mergedProps
          )
        }

        return this.renderedElement
      }
    }

    // Connect组件上赋了displayName和（展示名称，也就是组件类型）和WrappedComponent（被包装组件类）
    Connect.displayName = connectDisplayName
    Connect.WrappedComponent = WrappedComponent

    // 从context中获取Provider放的store
    Connect.contextTypes = {
      store: storeShape
    }
    Connect.propTypes = {
      store: storeShape
    }

    if (process.env.NODE_ENV !== 'production') {
      Connect.prototype.componentWillUpdate = function componentWillUpdate() {
        if (this.version === version) {
          return
        }

        // We are hot reloading!
        this.version = version
        this.trySubscribe()
        this.clearCache()
      }
    }

    // 将react组件中的所有属性拷贝到Connect组件中
    return hoistStatics(Connect, WrappedComponent)
  }
}
